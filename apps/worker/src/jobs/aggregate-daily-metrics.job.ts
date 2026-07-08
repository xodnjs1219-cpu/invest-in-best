/**
 * 일별 체인 지표 사전 집계 잡 (docs/usecases/029/plan.md 모듈 9).
 * 오케스트레이터: 중복 방지 → 범위 산출 → 정정 감지 → 체인 순회(일별·분기) → 기록.
 * 전 의존성 주입형(테스트는 mock으로 검증). 잡 전체를 try/catch로 감싸 어떤 예외도 스케줄러 프로세스로
 * 전파하지 않는다. UC-031(백필) 후속 트리거가 동일 인스턴스의 run()을 직접 호출하는 유일한 진입점이다.
 */
import {
  AGGREGATION_DATE_WINDOW_DAYS,
  BATCH_ERROR_LOG_MAX_LENGTH,
  BATCH_JOB_TYPE_AGGREGATE_DAILY_METRICS,
  BATCH_RUNNING_STALE_HOURS,
  FX_PAIR,
  calculateDailyChainMetric,
  calculateQuarterlyChainMetric,
  classifyQuarterlyConstituent,
  createCarryForwardResolver,
  enumerateDates,
  quarterEndDate,
  quarterStartDate,
  resolveDailyTargetRange,
  resolveEffectiveSnapshot,
  resolveTargetQuarters,
  splitRangeByWindow,
  todayInSeoul,
  toSeoulDayEndIso,
  type CarryForwardResolution,
  type IsoDate,
  type QuarterlyConstituent,
} from "@iib/domain";
import type { BatchLogger } from "../runtime/batch-log";
import type { FinishRunInput } from "../repositories/batch.repository";
import type { ActiveChain } from "../repositories/chains.repository";
import type { ChainSnapshot, ListedNode, SnapshotNodesSummary } from "../repositories/snapshots.repository";
import type {
  DailyClose,
  FxRateRow,
  LatestCloseBefore,
  LatestShares,
} from "../repositories/market-data.repository";
import type { QuarterRevenueRow } from "../repositories/financials.repository";
import type { DailyMetricRow, QuarterlyMetricRow } from "../repositories/chain-metrics.repository";
import type { RepoResult } from "../repositories/result";

const JOB_TYPE = BATCH_JOB_TYPE_AGGREGATE_DAILY_METRICS;

export interface AggregateDailyMetricsBatchRepo {
  findLatestRunByStatus(
    jobType: string,
    status: "success",
  ): Promise<RepoResult<{ id: string; startedAt: string } | null>>;
}

export interface AggregateDailyMetricsChainsRepo {
  findActiveChains(): Promise<RepoResult<ActiveChain[]>>;
}

export interface AggregateDailyMetricsSnapshotsRepo {
  findSnapshotsByChain(chainId: string, untilIso: string): Promise<RepoResult<ChainSnapshot[]>>;
  findNodesBySnapshotIds(snapshotIds: string[]): Promise<RepoResult<Map<string, SnapshotNodesSummary>>>;
}

export interface AggregateDailyMetricsMarketDataRepo {
  findDailyCloses(securityIds: string[], from: string, to: string): Promise<RepoResult<DailyClose[]>>;
  findLatestClosesBefore(securityIds: string[], before: string): Promise<RepoResult<LatestCloseBefore[]>>;
  findLatestShares(securityIds: string[]): Promise<RepoResult<Map<string, LatestShares>>>;
  findFxRates(
    pair: { base: "USD" | "KRW"; quote: "USD" | "KRW" },
    from: string,
    to: string,
  ): Promise<RepoResult<FxRateRow[]>>;
  findLatestFxBefore(
    pair: { base: "USD" | "KRW"; quote: "USD" | "KRW" },
    before: string,
  ): Promise<RepoResult<FxRateRow | null>>;
  findMinCorrectedQuoteDateSince(sinceIso: string): Promise<RepoResult<IsoDate | null>>;
  findMinCorrectedFxDateSince(sinceIso: string): Promise<RepoResult<IsoDate | null>>;
}

export interface AggregateDailyMetricsFinancialsRepo {
  findQuarterRevenues(
    securityIds: string[],
    year: number,
    quarter: number,
  ): Promise<RepoResult<QuarterRevenueRow[]>>;
  findAnnualOnlySecurities(
    securityIds: string[],
    year: number,
    quarterStart: IsoDate,
    quarterEnd: IsoDate,
  ): Promise<RepoResult<Set<string>>>;
  findMinCorrectedQuarterSince(sinceIso: string): Promise<RepoResult<{ year: number; quarter: number } | null>>;
}

export type ChainMetricsUpsertOutcome =
  | { ok: true; data: { count: number } }
  | { ok: false; kind: "chain_deleted"; message: string }
  | { ok: false; kind: "db_error"; message: string };

export interface AggregateDailyMetricsChainMetricsRepo {
  upsertDailyMetrics(rows: DailyMetricRow[]): Promise<ChainMetricsUpsertOutcome>;
  upsertQuarterlyMetrics(rows: QuarterlyMetricRow[]): Promise<ChainMetricsUpsertOutcome>;
}

export interface AggregateDailyMetricsJobDeps {
  repos: {
    batch: AggregateDailyMetricsBatchRepo;
    chains: AggregateDailyMetricsChainsRepo;
    snapshots: AggregateDailyMetricsSnapshotsRepo;
    marketData: AggregateDailyMetricsMarketDataRepo;
    financials: AggregateDailyMetricsFinancialsRepo;
    chainMetrics: AggregateDailyMetricsChainMetricsRepo;
  };
  batchLog: BatchLogger;
}

export interface AggregateDailyMetricsJob {
  run(now?: Date): Promise<void>;
}

interface ChainFailure {
  chainId: string;
  phase: "daily" | "quarterly";
  message: string;
}

export function createAggregateDailyMetricsJob(deps: AggregateDailyMetricsJobDeps): AggregateDailyMetricsJob {
  const { repos, batchLog } = deps;

  return {
    async run(now: Date = new Date()): Promise<void> {
      // 1차 방어(E11) — DB 2차 방어는 batchLog.isRunning이 담당(runtime/batch-log.ts, UC-026 공통 골격).
      const alreadyRunning = await batchLog.isRunning(JOB_TYPE, BATCH_RUNNING_STALE_HOURS);
      if (alreadyRunning) {
        console.warn(`[aggregate-daily-metrics] ${JOB_TYPE} already running — skip this tick without a new batch_runs row`);
        return;
      }

      const runId = await batchLog.start(JOB_TYPE);
      if (runId === null) {
        console.error("[aggregate-daily-metrics] failed to start a batch_runs record — proceeding without runId tracking");
      }

      try {
        await runInternal(runId, now);
      } catch (error) {
        console.error("[aggregate-daily-metrics] unexpected exception:", error);
        if (runId !== null) {
          await batchLog.finish(runId, {
            status: "failed",
            processedCount: 0,
            failedCount: 0,
            isCarriedOver: false,
            errorLog: `예상 밖 예외: ${(error as Error).message ?? String(error)}`,
          });
        }
      }
    },
  };

  async function runInternal(runId: string | null, now: Date): Promise<void> {
    const today = todayInSeoul(now);

    // ── 기준 실행 조회(직전 성공) ──
    const prevSuccessResult = await repos.batch.findLatestRunByStatus(JOB_TYPE, "success");
    if (!prevSuccessResult.ok) {
      await finish(runId, {
        status: "failed",
        processedCount: 0,
        failedCount: 0,
        isCarriedOver: false,
        errorLog: truncate(`대상 범위 산출 실패(직전 성공 조회): ${prevSuccessResult.error}`),
      });
      return;
    }
    const prevSuccess = prevSuccessResult.data;
    const sinceIso = prevSuccess?.startedAt ?? null;

    // ── 정정 워터마크 조회(sinceIso 없으면 스킵 — 전 기간이 이미 대상) ──
    let correctionQuoteDate: IsoDate | null = null;
    let correctionFxDate: IsoDate | null = null;
    let correctionQuarter: { year: number; quarter: number } | null = null;

    if (sinceIso !== null) {
      const [quoteWatermark, fxWatermark, quarterWatermark] = await Promise.all([
        repos.marketData.findMinCorrectedQuoteDateSince(sinceIso),
        repos.marketData.findMinCorrectedFxDateSince(sinceIso),
        repos.financials.findMinCorrectedQuarterSince(sinceIso),
      ]);
      if (!quoteWatermark.ok || !fxWatermark.ok || !quarterWatermark.ok) {
        const errors = [quoteWatermark, fxWatermark, quarterWatermark]
          .filter((r): r is { ok: false; error: string } => !r.ok)
          .map((r) => r.error)
          .join("; ");
        await finish(runId, {
          status: "failed",
          processedCount: 0,
          failedCount: 0,
          isCarriedOver: false,
          errorLog: truncate(`대상 범위 산출 실패(정정 워터마크 조회): ${errors}`),
        });
        return;
      }
      correctionQuoteDate = quoteWatermark.data;
      correctionFxDate = fxWatermark.data;
      correctionQuarter = quarterWatermark.data;
    }

    // ── 대상 범위 산출 ──
    const dailyRange = resolveDailyTargetRange({
      prevSuccessStartedAt: sinceIso,
      correctionMinDates: [correctionQuoteDate, correctionFxDate],
      today,
    });
    const targetQuarters = resolveTargetQuarters({
      correctionMinQuarter: correctionQuarter,
      fxCorrectionMinDate: correctionFxDate,
      hasPrevSuccess: prevSuccess !== null,
      to: dailyRange?.to ?? subtractOneDay(today),
    });

    // ── 대상 체인 로드 ──
    const chainsResult = await repos.chains.findActiveChains();
    if (!chainsResult.ok) {
      await finish(runId, {
        status: "failed",
        processedCount: 0,
        failedCount: 0,
        isCarriedOver: false,
        errorLog: truncate(`대상 체인 조회 실패: ${chainsResult.error}`),
      });
      return;
    }
    const chains = chainsResult.data;

    if (chains.length === 0) {
      await finish(runId, {
        status: "success",
        processedCount: 0,
        failedCount: 0,
        isCarriedOver: false,
        errorLog: null,
      });
      return;
    }

    // ── 체인 순회(순차 — E13) ──
    let processedCount = 0;
    const failures: ChainFailure[] = [];
    let skippedChains = 0;

    for (const chain of chains) {
      const chainOutcome = await processChain(chain, dailyRange, targetQuarters, now);
      processedCount += chainOutcome.processedCount;
      failures.push(...chainOutcome.failures);
      if (chainOutcome.wasFullySkipped) skippedChains += 1;
    }

    const effectiveChainCount = chains.length - skippedChains;
    // spec §6.4 failed_count는 "체인" 단위 실패 수 — 동일 체인이 daily·quarterly 양쪽에서 실패해도 1건으로 집계한다.
    const failedCount = new Set(failures.map((f) => f.chainId)).size;

    let status: FinishRunInput["status"];
    if (failedCount === 0) {
      status = "success";
    } else if (effectiveChainCount > 0 && failedCount >= effectiveChainCount) {
      status = "failed";
    } else {
      status = "partial_success";
    }

    const errorLog =
      failures.length > 0
        ? truncate(failures.map((f) => `chain=${f.chainId} phase=${f.phase}: ${f.message}`).join("; "))
        : null;

    await finish(runId, { status, processedCount, failedCount, isCarriedOver: false, errorLog });
  }

  interface ChainOutcome {
    processedCount: number;
    failures: ChainFailure[];
    /** chain_deleted(E15)로 전 구간이 스킵된 경우 — 실패 집계에서 제외하기 위한 신호. */
    wasFullySkipped: boolean;
  }

  async function processChain(
    chain: ActiveChain,
    dailyRange: { from: IsoDate; to: IsoDate } | null,
    targetQuarters: Array<{ year: number; quarter: number }>,
    now: Date,
  ): Promise<ChainOutcome> {
    const failures: ChainFailure[] = [];
    let processedCount = 0;
    let chainDeleted = false;

    // 스냅샷 로드 대상 상한 경계 — 일별 range.to 또는 오늘(분기만 대상일 때) 중 늦은 시점.
    const latestBoundaryDate = dailyRange?.to ?? todayInSeoul(now);
    const snapshotsResult = await repos.snapshots.findSnapshotsByChain(chain.id, toSeoulDayEndIso(latestBoundaryDate));
    if (!snapshotsResult.ok) {
      failures.push({ chainId: chain.id, phase: "daily", message: `스냅샷 조회 실패: ${snapshotsResult.error}` });
      return { processedCount, failures, wasFullySkipped: false };
    }
    const snapshots = snapshotsResult.data;
    if (snapshots.length === 0) {
      // E7 — 체인 생성 이전(스냅샷 없음). 실패 아님, 행 미기록.
      return { processedCount, failures, wasFullySkipped: false };
    }

    // ── 일별 집계 ──
    if (dailyRange !== null) {
      const firstSnapshotDate = todayInSeoul(new Date(snapshots[0]!.effectiveAt));
      const chainFrom = firstSnapshotDate > dailyRange.from ? firstSnapshotDate : dailyRange.from;

      if (chainFrom <= dailyRange.to) {
        for (const window of splitRangeByWindow(chainFrom, dailyRange.to, AGGREGATION_DATE_WINDOW_DAYS)) {
          const windowOutcome = await processDailyWindow(chain.id, snapshots, window);
          processedCount += windowOutcome.processedCount;
          failures.push(...windowOutcome.failures);
          if (windowOutcome.chainDeleted) {
            chainDeleted = true;
            break;
          }
        }
      }
    }

    // ── 분기 집계 ──
    if (!chainDeleted) {
      for (const q of targetQuarters) {
        const quarterOutcome = await processQuarter(chain.id, snapshots, q, now);
        if (quarterOutcome === null) continue; // E7 — 유효 스냅샷 없음, 스킵
        processedCount += quarterOutcome.processedCount;
        failures.push(...quarterOutcome.failures);
        if (quarterOutcome.chainDeleted) {
          chainDeleted = true;
          break;
        }
      }
    }

    return { processedCount, failures, wasFullySkipped: chainDeleted && failures.length === 0 };
  }

  async function processDailyWindow(
    chainId: string,
    snapshots: ChainSnapshot[],
    window: { from: IsoDate; to: IsoDate },
  ): Promise<{ processedCount: number; failures: ChainFailure[]; chainDeleted: boolean }> {
    const failures: ChainFailure[] = [];

    // 창 내 일자별 유효 스냅샷 산출 → 관련 스냅샷 집합 확정.
    const datesInWindow = enumerateDates(window.from, window.to);
    const effectiveSnapshotByDate = new Map<IsoDate, ChainSnapshot>();
    for (const date of datesInWindow) {
      const effective = resolveEffectiveSnapshot(snapshots, toSeoulDayEndIso(date));
      if (effective !== null) effectiveSnapshotByDate.set(date, effective);
    }
    if (effectiveSnapshotByDate.size === 0) {
      return { processedCount: 0, failures, chainDeleted: false };
    }

    const relevantSnapshotIds = [...new Set([...effectiveSnapshotByDate.values()].map((s) => s.id))];
    const nodesResult = await repos.snapshots.findNodesBySnapshotIds(relevantSnapshotIds);
    if (!nodesResult.ok) {
      failures.push({ chainId, phase: "daily", message: `노드 조회 실패: ${nodesResult.error}` });
      return { processedCount: 0, failures, chainDeleted: false };
    }
    const nodesBySnapshot = nodesResult.data;

    const allListedNodes = [...nodesBySnapshot.values()].flatMap((s) => s.listedNodes);
    const securityIds = [...new Set(allListedNodes.map((n) => n.securityId))];

    // 종목 유니버스에 대해 입력 일괄 로드.
    const [closesResult, seedClosesResult, sharesResult, fxRangeResult, seedFxResult] = await Promise.all([
      repos.marketData.findDailyCloses(securityIds, window.from, window.to),
      repos.marketData.findLatestClosesBefore(securityIds, window.from),
      repos.marketData.findLatestShares(securityIds),
      repos.marketData.findFxRates(FX_PAIR, window.from, window.to),
      repos.marketData.findLatestFxBefore(FX_PAIR, window.from),
    ]);

    if (!closesResult.ok || !seedClosesResult.ok || !sharesResult.ok || !fxRangeResult.ok || !seedFxResult.ok) {
      const errors = [closesResult, seedClosesResult, sharesResult, fxRangeResult, seedFxResult]
        .filter((r): r is { ok: false; error: string } => !r.ok)
        .map((r) => r.error)
        .join("; ");
      failures.push({ chainId, phase: "daily", message: `집계 입력 조회 실패: ${errors}` });
      return { processedCount: 0, failures, chainDeleted: false };
    }

    // 종목별 carry-forward 리졸버 구성.
    const closesBySecurity = new Map<string, Array<{ date: IsoDate; value: number }>>();
    for (const row of closesResult.data) {
      const list = closesBySecurity.get(row.securityId) ?? [];
      list.push({ date: row.tradeDate as IsoDate, value: row.closePrice });
      closesBySecurity.set(row.securityId, list);
    }
    const seedBySecurity = new Map<string, { date: IsoDate; value: number }>();
    for (const row of seedClosesResult.data) {
      seedBySecurity.set(row.securityId, { date: row.tradeDate as IsoDate, value: row.closePrice });
    }
    const closeResolvers = new Map(
      securityIds.map((id) => [
        id,
        createCarryForwardResolver(closesBySecurity.get(id) ?? [], seedBySecurity.get(id) ?? null),
      ]),
    );

    const fxObservations = fxRangeResult.data.map((r) => ({ date: r.rateDate as IsoDate, value: r.rate }));
    const fxSeed = seedFxResult.data ? { date: seedFxResult.data.rateDate as IsoDate, value: seedFxResult.data.rate } : null;
    const fxResolver = createCarryForwardResolver(fxObservations, fxSeed);

    // 일자별 계산 → 행 버퍼.
    const rows: DailyMetricRow[] = [];
    for (const [date, snapshot] of effectiveSnapshotByDate) {
      const summary = nodesBySnapshot.get(snapshot.id) ?? { totalNodeCount: 0, listedNodes: [] as ListedNode[] };
      const metric = calculateDailyChainMetric({
        totalNodeCount: summary.totalNodeCount,
        listedNodes: summary.listedNodes,
        closeOf: (securityId) => closeResolvers.get(securityId)?.resolve(date) ?? null,
        sharesOf: (securityId) => sharesResult.data.get(securityId)?.shares ?? null,
        fxRateAt: () => fxResolver.resolve(date),
      });
      rows.push({
        chainId,
        metricDate: date,
        basedOnSnapshotId: snapshot.id,
        totalMarketCapKrw: metric.totalMarketCapKrw,
        coveredNodeCount: metric.coveredNodeCount,
        totalNodeCount: metric.totalNodeCount,
        isCarriedForward: metric.isCarriedForward,
      });
    }

    const upsertOutcome = await repos.chainMetrics.upsertDailyMetrics(rows);
    if (!upsertOutcome.ok) {
      if (upsertOutcome.kind === "chain_deleted") {
        return { processedCount: 0, failures, chainDeleted: true };
      }
      failures.push({ chainId, phase: "daily", message: `일별 지표 적재 실패: ${upsertOutcome.message}` });
      return { processedCount: 0, failures, chainDeleted: false };
    }

    return { processedCount: rows.length, failures, chainDeleted: false };
  }

  async function processQuarter(
    chainId: string,
    snapshots: ChainSnapshot[],
    quarter: { year: number; quarter: number },
    now: Date,
  ): Promise<{ processedCount: number; failures: ChainFailure[]; chainDeleted: boolean } | null> {
    const failures: ChainFailure[] = [];
    const qEnd = quarterEndDate(quarter.year, quarter.quarter);
    const nowIso = now.toISOString();
    const quarterEndBoundary = toSeoulDayEndIso(qEnd);
    // Open Q4 확정 — min(분기 말일 당일 종료 경계, 실행 시점): 진행 중 분기는 실행 시점 기준.
    const boundary = quarterEndBoundary < nowIso ? quarterEndBoundary : nowIso;

    const effectiveSnapshot = resolveEffectiveSnapshot(snapshots, boundary);
    if (effectiveSnapshot === null) {
      return null; // E7 — 유효 스냅샷 없음, 스킵
    }

    const nodesResult = await repos.snapshots.findNodesBySnapshotIds([effectiveSnapshot.id]);
    if (!nodesResult.ok) {
      failures.push({ chainId, phase: "quarterly", message: `노드 조회 실패: ${nodesResult.error}` });
      return { processedCount: 0, failures, chainDeleted: false };
    }
    const summary = nodesResult.data.get(effectiveSnapshot.id) ?? { totalNodeCount: 0, listedNodes: [] as ListedNode[] };
    const securityIds = summary.listedNodes.map((n) => n.securityId);

    const qStart = quarterStartDate(quarter.year, quarter.quarter);
    const [revenuesResult, annualOnlyResult, fxAtQuarterEndResult] = await Promise.all([
      repos.financials.findQuarterRevenues(securityIds, quarter.year, quarter.quarter),
      repos.financials.findAnnualOnlySecurities(securityIds, quarter.year, qStart, qEnd),
      resolveQuarterEndFxRate(qEnd),
    ]);

    if (!revenuesResult.ok || !annualOnlyResult.ok || !fxAtQuarterEndResult.ok) {
      const errors = [revenuesResult, annualOnlyResult, fxAtQuarterEndResult]
        .filter((r): r is { ok: false; error: string } => !r.ok)
        .map((r) => r.error)
        .join("; ");
      failures.push({ chainId, phase: "quarterly", message: `분기 집계 입력 조회 실패: ${errors}` });
      return { processedCount: 0, failures, chainDeleted: false };
    }

    const revenueBySecurity = new Map(revenuesResult.data.map((r) => [r.securityId, r]));
    const fxRate = fxAtQuarterEndResult.data;

    const constituents: QuarterlyConstituent[] = summary.listedNodes.map((node) => {
      const quarterRow = revenueBySecurity.get(node.securityId) ?? null;
      const hasAnnualOnly = annualOnlyResult.data.has(node.securityId);
      const classification = classifyQuarterlyConstituent({
        quarterRow: quarterRow
          ? { revenue: quarterRow.revenue, currency: quarterRow.currency, isRevenueTagUnmapped: quarterRow.isRevenueTagUnmapped }
          : null,
        hasAnnualOnly,
        fxRate: fxRate?.value ?? null,
      });
      return {
        securityId: node.securityId,
        classification,
        revenue: quarterRow?.revenue ?? null,
        currency: quarterRow?.currency ?? node.currency,
        fxRate: fxRate?.value ?? null,
      };
    });

    const metric = calculateQuarterlyChainMetric(constituents, summary.totalNodeCount);

    const upsertOutcome = await repos.chainMetrics.upsertQuarterlyMetrics([
      {
        chainId,
        calendarYear: quarter.year,
        calendarQuarter: quarter.quarter,
        basedOnSnapshotId: effectiveSnapshot.id,
        totalRevenueKrw: metric.totalRevenueKrw,
        coveredNodeCount: metric.coveredNodeCount,
        totalNodeCount: metric.totalNodeCount,
        excludedUnmappedCount: metric.excludedUnmappedCount,
      },
    ]);
    if (!upsertOutcome.ok) {
      if (upsertOutcome.kind === "chain_deleted") {
        return { processedCount: 0, failures, chainDeleted: true };
      }
      failures.push({ chainId, phase: "quarterly", message: `분기 지표 적재 실패: ${upsertOutcome.message}` });
      return { processedCount: 0, failures, chainDeleted: false };
    }

    return { processedCount: 1, failures, chainDeleted: false };
  }

  /** 분기 말일 환율(결측 시 carry-forward) — 단일 일자 조회라 carry-forward 리졸버를 경량 구성한다. */
  async function resolveQuarterEndFxRate(quarterEnd: IsoDate): Promise<RepoResult<CarryForwardResolution<number> | null>> {
    const [sameDayResult, seedResult] = await Promise.all([
      repos.marketData.findFxRates(FX_PAIR, quarterEnd, quarterEnd),
      repos.marketData.findLatestFxBefore(FX_PAIR, quarterEnd),
    ]);
    if (!sameDayResult.ok) return sameDayResult;
    if (!seedResult.ok) return seedResult;

    const observations = sameDayResult.data.map((r) => ({ date: r.rateDate as IsoDate, value: r.rate }));
    const seed = seedResult.data ? { date: seedResult.data.rateDate as IsoDate, value: seedResult.data.rate } : null;
    const resolver = createCarryForwardResolver(observations, seed);
    return { ok: true, data: resolver.resolve(quarterEnd) };
  }

  async function finish(runId: string | null, summary: FinishRunInput): Promise<void> {
    if (runId === null) {
      console.error("[aggregate-daily-metrics] no runId — skipping finish() record", summary);
      return;
    }
    await batchLog.finish(runId, summary);
  }
}

function subtractOneDay(date: IsoDate): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10) as IsoDate;
}

function truncate(errorLog: string): string {
  return errorLog.length > BATCH_ERROR_LOG_MAX_LENGTH ? errorLog.slice(0, BATCH_ERROR_LOG_MAX_LENGTH) : errorLog;
}
