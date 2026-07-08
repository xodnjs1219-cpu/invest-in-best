/**
 * 시세 수집 잡 (docs/usecases/026/plan.md 모듈 15).
 * 오케스트레이터: 개장/확정 판정 → 수집 → 멱등 적재 → 잠정 집계 → 종가 확정 → 정리 → 기록.
 * 모든 의존성(포트·리포지토리·batchLog)은 주입형 — 테스트는 전부 mock으로 검증한다.
 * 잡 전체를 try/catch로 감싸 어떤 예외도 스케줄러 프로세스로 전파하지 않는다(설계 결정 4).
 */
import {
  BATCH_JOB_TYPE_COLLECT_QUOTES,
  BATCH_MAX_RETRY,
  MARKETS,
  QUOTE_TICKS_RETENTION_DAYS,
  localDayUtcRange,
  normalizeToHourUtc,
  resolveLocalDate,
  resolveMarketPhase,
  type MarketCalendarSession,
  type MarketCode,
  type MarketPhase,
} from "@iib/domain";
import type {
  GetPricesResult,
  NormalizedDailyCandle,
  TossInvestPort,
} from "../adapters/tossinvest/contract";
import { TossAuthError } from "../adapters/tossinvest/contract";
import type { BatchLogger } from "../runtime/batch-log";
import type { FinishRunInput, ItemFailureInput } from "../repositories/batch.repository";
import type { CollectTargetSecurity } from "../repositories/securities.repository";
import type {
  ConfirmedDailyRow,
  QuoteTickRow,
  UnconfirmedDailyTarget,
} from "../repositories/quotes.repository";
import type { RepoResult } from "../repositories/result";

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

export interface CollectQuotesRepos {
  findCollectTargets(markets: MarketCode[]): Promise<RepoResult<CollectTargetSecurity[]>>;
  findByMarketDate(
    market: MarketCode,
    localDate: string,
  ): Promise<RepoResult<MarketCalendarSession | null>>;
  upsertTicks(rows: QuoteTickRow[]): Promise<RepoResult<{ upsertedChunks: number }>>;
  upsertProvisionalDaily(
    market: MarketCode,
    tradeDate: string,
    fromUtc: Date,
    toUtc: Date,
  ): Promise<RepoResult<number>>;
  findUnconfirmedDaily(
    market: MarketCode,
    tradeDate: string,
  ): Promise<RepoResult<UnconfirmedDailyTarget[]>>;
  upsertConfirmedDaily(rows: ConfirmedDailyRow[]): Promise<RepoResult<void>>;
  deleteExpiredTicks(cutoffUtc: Date): Promise<RepoResult<number>>;
}

export interface CollectQuotesJobDeps {
  toss: TossInvestPort;
  batchLog: BatchLogger;
  repos: CollectQuotesRepos;
}

export interface CollectQuotesJob {
  run(now?: Date): Promise<void>;
}

interface MarketJudgement {
  market: MarketCode;
  localDate: string;
  phase: MarketPhase;
}

export function createCollectQuotesJob(deps: CollectQuotesJobDeps): CollectQuotesJob {
  const { toss, batchLog, repos } = deps;

  return {
    async run(now: Date = new Date()): Promise<void> {
      const runId = await batchLog.start(BATCH_JOB_TYPE_COLLECT_QUOTES);
      if (runId === null) {
        // 기록 자체가 실패해도 잡은 계속 시도한다(모니터링 실패가 본 작업을 막지 않음).
        console.error("[collect-quotes] failed to start a batch_runs record — proceeding without runId tracking");
      }

      try {
        await runInternal(runId, now);
      } catch (error) {
        console.error("[collect-quotes] unexpected exception:", error);
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
    const baseHour = normalizeToHourUtc(now);
    const skipReasons: string[] = [];

    // 1) 판정: 시장별 개장/확정 대상 식별.
    const judgements: MarketJudgement[] = [];
    for (const market of MARKETS) {
      const localDate = resolveLocalDate(market, baseHour);
      const calendarResult = await repos.findByMarketDate(market, localDate);
      if (!calendarResult.ok) {
        skipReasons.push(`${market}: 캘린더 조회 실패(${calendarResult.error})`);
        continue;
      }
      const phase = resolveMarketPhase(calendarResult.data, baseHour);
      if (phase === "unknown") {
        skipReasons.push(`${market}: market_calendar 당일 데이터 없음(E9) — 보수적 스킵`);
      }
      judgements.push({ market, localDate, phase });
    }

    const openMarkets = judgements.filter((j) => j.phase === "open");

    // after_close 시장 중 미확정 종목이 있는 시장만 확정 대상.
    const afterCloseCandidates = judgements.filter((j) => j.phase === "after_close");
    const confirmationTargets: Array<MarketJudgement & { targets: UnconfirmedDailyTarget[] }> = [];
    for (const judgement of afterCloseCandidates) {
      const unconfirmedResult = await repos.findUnconfirmedDaily(judgement.market, judgement.localDate);
      if (!unconfirmedResult.ok) {
        skipReasons.push(`${judgement.market}: 미확정 종목 조회 실패(${unconfirmedResult.error})`);
        continue;
      }
      if (unconfirmedResult.data.length > 0) {
        confirmationTargets.push({ ...judgement, targets: unconfirmedResult.data });
      }
    }

    // 3) 조기 종료(E1): 수집·확정 대상 모두 없고 E9 스킵도 없으면 success 0건.
    if (openMarkets.length === 0 && confirmationTargets.length === 0 && skipReasons.length === 0) {
      await finish(runId, { status: "success", processedCount: 0, failedCount: 0, isCarriedOver: false, errorLog: null });
      return;
    }

    // 4) 미해소 실패 확인(BR-7 대조용).
    const unresolvedFailures = await batchLog.unresolvedFailures(BATCH_JOB_TYPE_COLLECT_QUOTES);
    const unresolvedBySecurityId = new Map(
      unresolvedFailures.filter((f) => f.securityId !== null).map((f) => [f.securityId as string, f.id]),
    );

    let processedCount = 0;
    let failedCount = 0;
    let isCarriedOver = false;
    let authFailed = false;
    const itemFailures: ItemFailureInput[] = [];
    const succeededSecurityIds = new Set<string>();
    const repoFailureReasons: string[] = [];

    // 5) 수집 스텝.
    for (const judgement of openMarkets) {
      if (authFailed) break;

      const targetsResult = await repos.findCollectTargets([judgement.market]);
      if (!targetsResult.ok) {
        repoFailureReasons.push(`${judgement.market}: 종목 조회 실패(${targetsResult.error})`);
        continue;
      }
      const targets = targetsResult.data;
      if (targets.length === 0) continue;

      const symbolToSecurity = new Map(targets.map((t) => [t.tossSymbol, t]));
      const symbols = targets.map((t) => t.tossSymbol);

      let pricesResult: GetPricesResult;
      try {
        pricesResult = await toss.getPrices(symbols);
      } catch (error) {
        if (error instanceof TossAuthError) {
          authFailed = true;
          repoFailureReasons.push(`인증 실패(E5): ${error.message}`);
          break;
        }
        repoFailureReasons.push(`${judgement.market}: 시세 조회 실패(${(error as Error).message})`);
        continue;
      }

      const tickRows: QuoteTickRow[] = [];
      const tickSecurityIds: string[] = [];
      for (const quote of pricesResult.quotes) {
        const security = symbolToSecurity.get(quote.symbol);
        if (!security) continue;
        tickRows.push({
          securityId: security.id,
          observedAt: baseHour.toISOString(),
          price: quote.price,
          volume: quote.volume,
          source: "toss",
        });
        tickSecurityIds.push(security.id);
      }

      if (tickRows.length > 0) {
        const upsertResult = await repos.upsertTicks(tickRows);
        if (!upsertResult.ok) {
          repoFailureReasons.push(`${judgement.market}: 틱 적재 실패(${upsertResult.error})`);
        } else {
          for (const securityId of tickSecurityIds) {
            succeededSecurityIds.add(securityId);
            processedCount += 1;
          }
          const { fromUtc, toUtc } = localDayUtcRange(judgement.market, judgement.localDate);
          const provisionalResult = await repos.upsertProvisionalDaily(
            judgement.market,
            judgement.localDate,
            fromUtc,
            toUtc,
          );
          if (!provisionalResult.ok) {
            repoFailureReasons.push(`${judgement.market}: 잠정 집계 실패(${provisionalResult.error})`);
          }
        }
      }

      for (const failure of pricesResult.failures) {
        const security = symbolToSecurity.get(failure.symbol);
        if (!security) continue;
        itemFailures.push({
          securityId: security.id,
          attemptCount: BATCH_MAX_RETRY,
          lastError: `${failure.reason}: ${failure.message}`,
        });
        failedCount += 1;
      }

      if (pricesResult.carriedOverSymbols.length > 0) {
        isCarriedOver = true;
      }
    }

    // 6) 종가 확정 스텝.
    if (!authFailed) {
      for (const judgement of confirmationTargets) {
        const confirmedRows: ConfirmedDailyRow[] = [];
        for (const target of judgement.targets) {
          try {
            const candle: NormalizedDailyCandle | null = await toss.getConfirmedDailyCandle(
              target.tossSymbol,
              judgement.localDate,
              judgement.market,
            );
            if (candle === null) {
              continue; // E10: 미발행 — 오류 아님, 실패 기록 없이 미확정 유지
            }
            confirmedRows.push({
              securityId: target.securityId,
              tradeDate: judgement.localDate,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
            });
            succeededSecurityIds.add(target.securityId);
            processedCount += 1;
          } catch (error) {
            if (error instanceof TossAuthError) {
              authFailed = true;
              repoFailureReasons.push(`인증 실패(E5): ${error.message}`);
              break;
            }
            itemFailures.push({
              securityId: target.securityId,
              attemptCount: BATCH_MAX_RETRY,
              lastError: `종가 확정 실패: ${(error as Error).message}`,
            });
            failedCount += 1;
          }
        }
        if (confirmedRows.length > 0) {
          const upsertResult = await repos.upsertConfirmedDaily(confirmedRows);
          if (!upsertResult.ok) {
            repoFailureReasons.push(`${judgement.market}: 종가 확정 UPSERT 실패(${upsertResult.error})`);
          }
        }
        if (authFailed) break;
      }
    }

    // 8) 실패 기록·해소.
    if (runId !== null && itemFailures.length > 0) {
      await batchLog.itemFailures(runId, itemFailures);
    }
    const resolvedIds = [...succeededSecurityIds]
      .map((securityId) => unresolvedBySecurityId.get(securityId))
      .filter((id): id is string => id !== undefined);
    if (resolvedIds.length > 0) {
      await batchLog.resolve(resolvedIds);
    }

    // 7) 정리 스텝(인증 실패 시 스킵 — E5 즉시 종료 경로).
    if (!authFailed) {
      const cutoffUtc = new Date(baseHour.getTime() - QUOTE_TICKS_RETENTION_DAYS * MS_PER_DAY);
      const deleteResult = await repos.deleteExpiredTicks(cutoffUtc);
      if (!deleteResult.ok) {
        console.error(`[collect-quotes] deleteExpiredTicks warning: ${deleteResult.error}`);
      }
    }

    // 9) 종료 기록.
    const allErrorReasons = [...skipReasons, ...repoFailureReasons];
    const errorLog = allErrorReasons.length > 0 ? allErrorReasons.join("; ") : null;

    let status: FinishRunInput["status"];
    if (authFailed) {
      status = "failed";
    } else if (
      failedCount > 0 ||
      skipReasons.length > 0 ||
      repoFailureReasons.length > 0
    ) {
      // 전량 실패(수집 대상이 있었는데 처리 0건)인 경우 failed로 승격.
      const hadTargets = openMarkets.length > 0 || confirmationTargets.length > 0;
      status = hadTargets && processedCount === 0 && failedCount === 0 && repoFailureReasons.length > 0
        ? "failed"
        : "partial_success";
    } else {
      status = "success";
    }

    await finish(runId, {
      status,
      processedCount,
      failedCount,
      isCarriedOver,
      errorLog,
    });
  }

  async function finish(runId: string | null, summary: FinishRunInput): Promise<void> {
    if (runId === null) {
      console.error("[collect-quotes] no runId — skipping finish() record", summary);
      return;
    }
    await batchLog.finish(runId, summary);
  }
}
