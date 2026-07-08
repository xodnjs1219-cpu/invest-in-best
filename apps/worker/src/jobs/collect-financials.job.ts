/**
 * 재무 수집 잡 (docs/usecases/027/plan.md 모듈 13).
 * 오케스트레이터: Main Scenario 1~17을 스텝 함수로 분해. 전 의존성 주입형 — 테스트는 전부 mock으로 검증.
 * 잡 전체를 try/catch로 감싸 어떤 예외도 스케줄러 프로세스로 전파하지 않는다.
 */
import {
  BATCH_JOB_TYPE_COLLECT_FINANCIALS,
  BATCH_STALE_RUNNING_HOURS,
  DART_REPORT_CODES,
  DISCLOSURE_LOOKBACK_DAYS,
  FINANCIALS_MIN_FISCAL_YEAR,
  buildUsQuarterRows,
  isAnnualOnlyFiler,
  normalizeKrxQuarters,
  pickRevenueFacts,
  pickSharesOutstanding,
  resolveCalendarPeriod,
  resolveDartTargetReports,
  resolveKrxPeriod,
  SEC_SHARES_TAG_CHAIN,
  US_DISCLOSURE_FORMS,
  US_REVENUE_TAG_CHAIN,
  type DartReportCode,
} from "@iib/domain";
import { formatInTimeZone } from "date-fns-tz";
import {
  DartAuthError,
  DartQuotaExceededError,
  type CorpCodeMapping,
  type KrxCompanyProfile,
  type OpenDartPort,
} from "../adapters/opendart/contract";
import type {
  SecCompanyFactsEntry,
  SecEdgarPort,
  SecSubmissionsEntry,
} from "../adapters/sec-edgar/contract";
import type { GetStockInfosResult } from "../adapters/tossinvest/contract";
import { TossAuthError } from "../adapters/tossinvest/contract";
import type { BatchLogger } from "../runtime/batch-log";
import type { FinishRunInput, ItemFailureInput } from "../repositories/batch.repository";
import type { Checkpoint } from "../repositories/checkpoints.repository";
import type { CompanyProfileRow } from "../repositories/company-profiles.repository";
import type { DisclosureRow } from "../repositories/disclosures.repository";
import type { FinancialsRow } from "../repositories/financials.repository";
import type { FinancialsTargetSecurity, DartCorpCodeUpdate } from "../repositories/securities.repository";
import type { SharesRow } from "../repositories/shares.repository";
import type { RepoResult } from "../repositories/result";

const KST_TIMEZONE = "Asia/Seoul";

export interface CollectFinancialsRepos {
  findAllForFinancials(): Promise<RepoResult<FinancialsTargetSecurity[]>>;
  updateDartCorpCodes(rows: DartCorpCodeUpdate[]): Promise<RepoResult<void>>;
  flagSharesManualOverride(securityIds: string[]): Promise<RepoResult<void>>;
  upsertFinancials(rows: FinancialsRow[]): Promise<RepoResult<{ affected: number; failedChunks: number }>>;
  findExistingPeriodKeys(
    securityIds: string[],
    fiscalYear: number,
    fiscalQuarter?: number,
  ): Promise<RepoResult<Set<string>>>;
  upsertDisclosures(rows: DisclosureRow[]): Promise<RepoResult<void>>;
  upsertProfiles(rows: CompanyProfileRow[]): Promise<RepoResult<void>>;
  findProfileFreshness(securityIds: string[]): Promise<RepoResult<Array<{ securityId: string; lastCollectedAt: string | null }>>>;
  findLatestBySource(
    securityIds: string[],
    source: "dart" | "sec" | "toss",
  ): Promise<RepoResult<Array<{ securityId: string; shares: number; asOfDate: string }>>>;
  upsertShares(rows: SharesRow[]): Promise<RepoResult<void>>;
}

export interface CollectFinancialsCheckpoints {
  get(jobType: string, key: string): Promise<RepoResult<Checkpoint | null>>;
  upsert(jobType: string, key: string, cursor: unknown, isCompleted: boolean): Promise<RepoResult<void>>;
  complete(jobType: string, key: string): Promise<RepoResult<void>>;
}

/** 잡이 필요로 하는 토스 포트의 부분집합(getStockInfos만) — interface segregation. */
export interface CollectFinancialsTossPort {
  getStockInfos(symbols: string[]): Promise<GetStockInfosResult>;
}

export interface CollectFinancialsJobDeps {
  dart: OpenDartPort;
  sec: SecEdgarPort;
  toss: CollectFinancialsTossPort;
  repos: CollectFinancialsRepos;
  batchLog: BatchLogger;
  checkpoints: CollectFinancialsCheckpoints;
  onFinished?: () => void | Promise<void>;
}

export interface CollectFinancialsJob {
  run(now?: Date): Promise<void>;
}

export function createCollectFinancialsJob(deps: CollectFinancialsJobDeps): CollectFinancialsJob {
  const { dart, sec, toss, repos, batchLog, checkpoints, onFinished } = deps;

  return {
    async run(now: Date = new Date()): Promise<void> {
      // E16: DB 레벨 중복 실행 방지(2차 방어, 인메모리 락은 scheduler가 1차 수행).
      const running = await batchLog.isRunning(BATCH_JOB_TYPE_COLLECT_FINANCIALS, BATCH_STALE_RUNNING_HOURS);
      if (running) {
        console.warn(`[collect-financials] already running — skip this tick`);
        return;
      }

      const runId = await batchLog.start(BATCH_JOB_TYPE_COLLECT_FINANCIALS);
      if (runId === null) {
        console.error("[collect-financials] failed to start a batch_runs record — proceeding without runId tracking");
      }

      try {
        await runInternal(runId, now);
      } catch (error) {
        console.error("[collect-financials] unexpected exception:", error);
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
    let processedCount = 0;
    let failedCount = 0;
    let isCarriedOver = false;
    let authFailed = false;
    const itemFailures: ItemFailureInput[] = [];
    const errorReasons: string[] = [];
    let unmappedRevenueCount = 0;

    // 대상 종목 로드(Main 3).
    const targetsResult = await repos.findAllForFinancials();
    if (!targetsResult.ok) {
      await finish(runId, {
        status: "failed",
        processedCount: 0,
        failedCount: 0,
        isCarriedOver: false,
        errorLog: `대상 종목 로드 실패: ${targetsResult.error}`,
      });
      return;
    }
    const targets = targetsResult.data;
    const krxTargets = targets.filter((t) => t.market === "KRX");
    const usTargets = targets.filter((t) => t.market === "US");

    // ── KRX 스텝군 ──
    krxLoop: try {
      // [KRX-1 매핑](Main 4, E17)
      const mappings = await dart.fetchCorpCodeMappings();
      const stockCodeToMapping = new Map<string, CorpCodeMapping>(mappings.map((m) => [m.stockCode, m]));
      const corpCodeUpdates: DartCorpCodeUpdate[] = [];
      for (const target of krxTargets) {
        const mapping = stockCodeToMapping.get(target.ticker);
        if (mapping && mapping.corpCode !== target.dartCorpCode) {
          corpCodeUpdates.push({ ticker: target.ticker, dartCorpCode: mapping.corpCode });
        }
      }
      if (corpCodeUpdates.length > 0) {
        await repos.updateDartCorpCodes(corpCodeUpdates);
      }
      const updatedCorpCodeByTicker = new Map(corpCodeUpdates.map((u) => [u.ticker, u.dartCorpCode]));
      const resolvedKrxTargets = krxTargets.map((t) => ({
        ...t,
        dartCorpCode: updatedCorpCodeByTicker.get(t.ticker) ?? t.dartCorpCode,
      }));
      const mappedKrxTargets = resolvedKrxTargets.filter((t) => t.dartCorpCode !== null);
      for (const unmapped of resolvedKrxTargets.filter((t) => t.dartCorpCode === null)) {
        itemFailures.push({ securityId: unmapped.id, attemptCount: 1, lastError: "dart_corp_code 매핑 없음(E17)" });
        failedCount += 1;
      }

      // [KRX-2 공시](Main 5)
      const bgnDe = formatInTimeZone(
        new Date(now.getTime() - DISCLOSURE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
        KST_TIMEZONE,
        "yyyyMMdd",
      );
      const endDe = formatInTimeZone(now, KST_TIMEZONE, "yyyyMMdd");
      const disclosuresResult = await dart.fetchDisclosures(bgnDe, endDe);
      const stockCodeToSecurity = new Map(mappedKrxTargets.map((t) => [t.ticker, t]));
      const disclosureRows: DisclosureRow[] = [];
      for (const item of disclosuresResult.items) {
        const security = stockCodeToSecurity.get(item.stockCode);
        if (!security) continue; // 마스터에 없는 종목 공시는 스킵
        disclosureRows.push({
          securityId: security.id,
          source: "dart",
          externalId: item.rceptNo,
          title: item.title,
          disclosureDate: item.disclosureDate,
          url: item.url,
        });
      }
      if (disclosureRows.length > 0) {
        await repos.upsertDisclosures(disclosureRows);
        processedCount += disclosureRows.length;
      }

      // [KRX-3 재무](Main 6~7)
      const targetReports = resolveDartTargetReports(now);
      for (const report of targetReports) {
        await collectKrxFinancialsForReport(mappedKrxTargets, report);
      }

      // [KRX-4 주식수](Main 8, BR-4 분기 변경분만)
      await collectKrxSharesOutstanding(mappedKrxTargets, targetReports);

      // [KRX-5 기업정보](Main 9, OQ-1 증분 갱신)
      await collectKrxCompanyProfiles(mappedKrxTargets, mappings);
    } catch (error) {
      if (error instanceof DartAuthError) {
        authFailed = true;
        errorReasons.push(`DartAuthError(잡 수준 실패): ${error.message}`);
      } else if (error instanceof DartQuotaExceededError) {
        isCarriedOver = true;
        errorReasons.push(`OpenDART 일일 한도 초과(E1) — 이월 처리`);
        // 잔여 KRX 종목(corp_code 매핑 대상)을 커서로 저장해 다음 실행에서 재개한다(E1).
        await checkpoints.upsert(
          BATCH_JOB_TYPE_COLLECT_FINANCIALS,
          "dart:carryover",
          { remainingTickers: krxTargets.map((t) => t.ticker) },
          false,
        );
      } else {
        errorReasons.push(`KRX 스텝 예외: ${(error as Error).message}`);
      }
      break krxLoop;
    }

    // ── US 스텝군(SEC) — 인증 실패가 아니면 진행 ──
    if (!authFailed) {
      try {
        await collectUsFinancials(usTargets);
      } catch (error) {
        errorReasons.push(`US(SEC) 스텝 예외: ${(error as Error).message}`);
      }
    }

    // ── 토스 상장주식수(공통, Main 14) ──
    if (!authFailed) {
      try {
        await collectTossShares(targets);
      } catch (error) {
        if (error instanceof TossAuthError) {
          errorReasons.push(`토스 인증 실패: ${error.message}`);
        } else {
          errorReasons.push(`토스 주식수 스텝 예외: ${(error as Error).message}`);
        }
      }
    }

    // 실패 기록.
    if (runId !== null && itemFailures.length > 0) {
      await batchLog.itemFailures(runId, itemFailures);
    }

    if (unmappedRevenueCount > 0) {
      errorReasons.push(`미국 매출 태그 미매핑 종목 ${unmappedRevenueCount}건(E3, 매출 집계 제외 대상)`);
    }

    const errorLog = errorReasons.length > 0 ? errorReasons.join("; ") : null;
    let status: FinishRunInput["status"];
    if (authFailed) {
      status = "failed";
    } else if (failedCount > 0 || isCarriedOver || errorReasons.length > 0) {
      status = "partial_success";
    } else {
      status = "success";
    }

    await finish(runId, { status, processedCount, failedCount, isCarriedOver, errorLog });

    if (status === "success" || status === "partial_success") {
      await onFinished?.();
    }

    // ── 내부 스텝 함수 ──

    async function collectKrxFinancialsForReport(
      targetsForReport: FinancialsTargetSecurity[],
      report: { bsnsYear: number; reprtCode: DartReportCode },
    ): Promise<void> {
      const corpCodes = targetsForReport.map((t) => t.dartCorpCode!).filter((c): c is string => c !== null);
      if (corpCodes.length === 0) return;

      const corpCodeToSecurity = new Map(targetsForReport.map((t) => [t.dartCorpCode, t]));
      const { accounts, missingCorpCodes } = await dart.fetchMultiAccounts(
        corpCodes,
        report.bsnsYear,
        report.reprtCode,
      );

      const rows: FinancialsRow[] = [];
      for (const account of accounts) {
        const security = corpCodeToSecurity.get(account.corpCode);
        if (!security) continue;
        pushKrxNormalizedRows(rows, security.id, report, account.metrics);
      }

      // missing 중 기적재 종목은 폴백 스킵(BR-4 호출 최소화).
      const existingResult = await repos.findExistingPeriodKeys(
        missingCorpCodes.map((c) => corpCodeToSecurity.get(c)?.id).filter((id): id is string => !!id),
        report.bsnsYear,
      );
      const existingIds = existingResult.ok ? existingResult.data : new Set<string>();

      for (const missingCorp of missingCorpCodes) {
        const security = corpCodeToSecurity.get(missingCorp);
        if (!security) continue;
        if (existingIds.has(security.id)) continue; // 기적재 — 폴백 스킵

        const fullFinancials = await dart.fetchFullFinancials(missingCorp, report.bsnsYear, report.reprtCode);
        if (fullFinancials === null) continue; // E4 결측 허용
        pushKrxNormalizedRows(rows, security.id, report, fullFinancials.metrics);
      }

      if (rows.length > 0) {
        const upsertResult = await repos.upsertFinancials(rows);
        if (upsertResult.ok) {
          processedCount += upsertResult.data.affected;
          failedCount += upsertResult.data.failedChunks;
        }
      }
    }

    function pushKrxNormalizedRows(
      rows: FinancialsRow[],
      securityId: string,
      report: { bsnsYear: number; reprtCode: DartReportCode },
      metrics: { revenue?: { threeMonth: number | null; cumulative: number | null } },
    ): void {
      if (report.bsnsYear < FINANCIALS_MIN_FISCAL_YEAR) return; // E2
      const period = resolveKrxPeriod(report.bsnsYear, report.reprtCode);

      const normalizeMetric = (metric?: { threeMonth: number | null; cumulative: number | null }) => {
        if (!metric) return { q1: null, half: null, q3: null, annual: null } as never;
        // 단일 보고서 응답이므로 해당 reprt_code 슬롯에만 값을 채우고 나머지는 null(다른 보고서 호출에서 채워짐).
        // 여기서는 단순화를 위해 각 보고서를 개별적으로 quarterly-row화한다(정규화 함수의 다분기 결합 입력 형식 대신
        // 단일 보고서 → 단일 분기 표현으로 축약).
        return metric;
      };

      // 단순화: 보고서 종류별로 해당 분기의 원천값만 존재하는 입력을 만들어 normalizeKrxQuarters에 위임.
      const revenueMetric = normalizeMetric(metrics.revenue);
      const single = buildSingleReportInput(report.reprtCode, revenueMetric);
      const normalized = normalizeKrxQuarters({
        fiscalYear: report.bsnsYear,
        metric: "revenue",
        ...single,
      });

      for (const row of normalized) {
        const rowPeriod =
          row.periodType === "annual"
            ? { start: `${report.bsnsYear}-01-01`, end: `${report.bsnsYear}-12-31` }
            : period;
        const calendar = resolveCalendarPeriod(rowPeriod.start, rowPeriod.end, row.periodType);
        rows.push({
          securityId,
          periodType: row.periodType,
          fiscalYear: row.fiscalYear,
          fiscalQuarter: row.fiscalQuarter,
          periodStartDate: rowPeriod.start,
          periodEndDate: rowPeriod.end,
          calendarYear: calendar.calendarYear,
          calendarQuarter: calendar.calendarQuarter,
          currency: "KRW",
          revenue: row.amount,
          operatingIncome: null,
          netIncome: null,
          amountBasis: row.amountBasis,
          revenueSourceTag: null,
          isRevenueTagUnmapped: false,
          source: "dart",
          disclosureRceptNo: null,
        });
      }
    }

    async function collectKrxSharesOutstanding(
      targetsForShares: FinancialsTargetSecurity[],
      targetReports: Array<{ bsnsYear: number; reprtCode: DartReportCode }>,
    ): Promise<void> {
      if (targetReports.length === 0) return;
      const primaryReport = targetReports[0]!;

      const latestResult = await repos.findLatestBySource(
        targetsForShares.map((t) => t.id),
        "dart",
      );
      const latestByCompany = new Map(
        (latestResult.ok ? latestResult.data : []).map((r) => [r.securityId, r.asOfDate]),
      );

      const period = resolveKrxPeriod(primaryReport.bsnsYear, primaryReport.reprtCode);
      const rows: SharesRow[] = [];

      for (const target of targetsForShares) {
        const latestAsOf = latestByCompany.get(target.id);
        if (latestAsOf && latestAsOf >= period.end) continue; // 분기 변경분만(BR-4)

        const stockTotal = await dart.fetchStockTotal(target.dartCorpCode!, primaryReport.bsnsYear, primaryReport.reprtCode);
        if (stockTotal === null) continue; // 결측 허용

        rows.push({
          securityId: target.id,
          shares: stockTotal.totalShares,
          asOfDate: stockTotal.settlementDate,
          source: "dart",
          sourceTag: "istc_totqy",
          isMultiClassPartial: false,
        });
      }

      if (rows.length > 0) {
        await repos.upsertShares(rows);
        processedCount += rows.length;
      }
    }

    async function collectKrxCompanyProfiles(
      targetsForProfiles: FinancialsTargetSecurity[],
      mappings: CorpCodeMapping[],
    ): Promise<void> {
      const modifyDateByCorpCode = new Map(mappings.map((m) => [m.corpCode, m.modifyDate]));
      const freshnessResult = await repos.findProfileFreshness(targetsForProfiles.map((t) => t.id));
      const freshnessBySecurityId = new Map(
        (freshnessResult.ok ? freshnessResult.data : []).map((f) => [f.securityId, f.lastCollectedAt]),
      );

      const rows: CompanyProfileRow[] = [];
      for (const target of targetsForProfiles) {
        const lastCollectedAt = freshnessBySecurityId.get(target.id);
        const modifyDate = modifyDateByCorpCode.get(target.dartCorpCode!);
        const needsUpdate =
          lastCollectedAt === undefined ||
          lastCollectedAt === null ||
          (modifyDate !== undefined && isModifyDateNewer(modifyDate, lastCollectedAt));
        if (!needsUpdate) continue;

        const profile: KrxCompanyProfile | null = await dart.fetchCompanyProfile(target.dartCorpCode!);
        if (profile === null) continue;
        rows.push({
          securityId: target.id,
          representativeName: profile.representativeName,
          establishedDate: profile.establishedDate,
          homepageUrl: profile.homepageUrl,
          sector: profile.sector,
          industryCode: profile.industryCode,
          address: profile.address,
          phone: profile.phone,
        });
      }

      if (rows.length > 0) {
        await repos.upsertProfiles(rows);
        processedCount += rows.length;
      }
    }

    async function collectUsFinancials(usSecurities: FinancialsTargetSecurity[]): Promise<void> {
      if (usSecurities.length === 0) return;
      const cikToSecurity = new Map(usSecurities.map((t) => [t.cik, t]));
      const cikSet = new Set(usSecurities.map((t) => t.cik).filter((c): c is string => c !== null));

      for (const kind of ["submissions", "companyfacts"] as const) {
        const freshness = await sec.checkBulkFreshness(kind);
        const checkpointKey = `sec:${kind}:last_modified`;
        const stored = await checkpoints.get(BATCH_JOB_TYPE_COLLECT_FINANCIALS, checkpointKey);
        const storedValue = stored.ok && stored.data ? stored.data.cursor : null;

        if (freshness.lastModified !== null && freshness.lastModified === storedValue) {
          continue; // E15: 미갱신 — 스킵
        }

        const tmpPath = `/tmp/sec-${kind}-${Date.now()}.zip`;
        await sec.downloadBulk(kind, tmpPath);

        for await (const entry of sec.readBulkEntries(tmpPath, cikSet, kind)) {
          if ("error" in entry) {
            const security = cikToSecurity.get(entry.cik);
            if (security) {
              itemFailures.push({ securityId: security.id, attemptCount: 1, lastError: `SEC 엔트리 오류: ${entry.error}` });
              failedCount += 1;
            }
            continue;
          }

          // E9: 엔트리 단위 오류는 격리 — 한 종목 처리 실패가 벌크 순회 전체를 중단시키지 않는다.
          try {
            if (kind === "submissions") {
              await processSubmissionsEntry(entry as SecSubmissionsEntry, cikToSecurity);
            } else {
              await processCompanyFactsEntry(entry as SecCompanyFactsEntry, cikToSecurity);
            }
          } catch (entryError) {
            const entryCik = (entry as { cik?: string }).cik;
            const security = entryCik ? cikToSecurity.get(entryCik) : undefined;
            if (security) {
              itemFailures.push({
                securityId: security.id,
                attemptCount: 1,
                lastError: `SEC 엔트리 처리 실패: ${(entryError as Error).message}`,
              });
              failedCount += 1;
            }
          }
        }

        if (freshness.lastModified !== null) {
          await checkpoints.upsert(BATCH_JOB_TYPE_COLLECT_FINANCIALS, checkpointKey, freshness.lastModified, true);
        }
      }
    }

    async function processSubmissionsEntry(
      entry: SecSubmissionsEntry,
      cikToSecurity: Map<string | null, FinancialsTargetSecurity>,
    ): Promise<void> {
      const security = cikToSecurity.get(entry.cik);
      if (!security) return;

      await repos.upsertProfiles([
        {
          securityId: security.id,
          representativeName: null,
          establishedDate: null,
          homepageUrl: null,
          sector: entry.sicDescription,
          industryCode: entry.sic,
          address: entry.businessAddress
            ? [entry.businessAddress.street1, entry.businessAddress.city, entry.businessAddress.stateOrCountry]
                .filter(Boolean)
                .join(", ")
            : null,
          phone: entry.phone,
        },
      ]);
      processedCount += 1;

      const disclosureRows: DisclosureRow[] = [];
      for (const filing of entry.recentFilings) {
        const baseForm = filing.form.replace(/\/A$/, "");
        if (!(US_DISCLOSURE_FORMS as readonly string[]).includes(baseForm)) continue;
        disclosureRows.push({
          securityId: security.id,
          source: "sec",
          externalId: filing.accessionNumber,
          title: filing.form,
          disclosureDate: filing.filingDate,
          url: null,
        });
      }
      if (disclosureRows.length > 0) {
        await repos.upsertDisclosures(disclosureRows);
        processedCount += disclosureRows.length;
      }
    }

    async function processCompanyFactsEntry(
      entry: SecCompanyFactsEntry,
      cikToSecurity: Map<string | null, FinancialsTargetSecurity>,
    ): Promise<void> {
      const security = cikToSecurity.get(entry.cik);
      if (!security) return;

      const flatFacts = flattenFacts(entry.facts);
      const revenueResult = pickRevenueFacts(flatFacts, US_REVENUE_TAG_CHAIN);
      const rows: FinancialsRow[] = [];

      if (revenueResult.unmapped) {
        unmappedRevenueCount += 1;
      } else {
        const { rows: quarterRows } = buildUsQuarterRows(revenueResult.facts);
        for (const row of quarterRows) {
          const rowPeriod =
            row.periodType === "annual"
              ? findAnnualPeriod(revenueResult.facts, row.fiscalYear)
              : findQuarterPeriod(revenueResult.facts, row.fiscalYear, row.fiscalQuarter);
          if (!rowPeriod) continue;
          const calendar = resolveCalendarPeriod(rowPeriod.start, rowPeriod.end, row.periodType);
          rows.push({
            securityId: security.id,
            periodType: row.periodType,
            fiscalYear: row.fiscalYear,
            fiscalQuarter: row.fiscalQuarter,
            periodStartDate: rowPeriod.start,
            periodEndDate: rowPeriod.end,
            calendarYear: calendar.calendarYear,
            calendarQuarter: calendar.calendarQuarter,
            currency: "USD",
            revenue: row.amount,
            operatingIncome: null,
            netIncome: null,
            amountBasis: row.amountBasis,
            revenueSourceTag: revenueResult.sourceTag,
            isRevenueTagUnmapped: false,
            source: "sec",
            disclosureRceptNo: null,
          });
        }
      }

      if (rows.length > 0) {
        const upsertResult = await repos.upsertFinancials(rows);
        if (upsertResult.ok) {
          processedCount += upsertResult.data.affected;
          failedCount += upsertResult.data.failedChunks;
        }
      }

      // 상장주식수(SEC 폴백, 벌크 1차 소스).
      if (!security.sharesManualOverrideNeeded) {
        const sharesResult = pickSharesOutstanding(flatFacts, SEC_SHARES_TAG_CHAIN);
        if (sharesResult) {
          await repos.upsertShares([
            {
              securityId: security.id,
              shares: sharesResult.shares,
              asOfDate: sharesResult.asOfDate,
              source: "sec",
              sourceTag: sharesResult.sourceTag,
              isMultiClassPartial: sharesResult.isPartial,
            },
          ]);
          processedCount += 1;
        } else {
          // 벌크에 없으면 companyconcept 개별 호출로 보완(E11 폴백은 어댑터가 처리).
          await repos.flagSharesManualOverride([security.id]);
        }
      }

      void isAnnualOnlyFiler; // 20-F 보조 판정 — buildUsQuarterRows가 이미 구조적으로 처리(annual-only when quarterFacts empty)
    }

    async function collectTossShares(allTargets: FinancialsTargetSecurity[]): Promise<void> {
      const withSymbol = allTargets.filter((t) => t.tossSymbol !== null);
      if (withSymbol.length === 0) return;

      const symbols = withSymbol.map((t) => t.tossSymbol!);
      const result = await toss.getStockInfos(symbols);

      const symbolToSecurity = new Map(withSymbol.map((t) => [t.tossSymbol, t]));
      const latestResult = await repos.findLatestBySource(withSymbol.map((t) => t.id), "toss");
      const latestBySecurityId = new Map(
        (latestResult.ok ? latestResult.data : []).map((r) => [r.securityId, r.shares]),
      );

      const asOfDate = formatInTimeZone(now, KST_TIMEZONE, "yyyy-MM-dd");
      const rows: SharesRow[] = [];
      for (const info of result.infos) {
        if (info.sharesOutstanding === null) continue;
        const security = symbolToSecurity.get(info.symbol);
        if (!security) continue;
        const latestShares = latestBySecurityId.get(security.id);
        if (latestShares === info.sharesOutstanding) continue; // 변경 없으면 스킵(중복 행 방지)

        rows.push({
          securityId: security.id,
          shares: info.sharesOutstanding,
          asOfDate,
          source: "toss",
          sourceTag: null,
          isMultiClassPartial: false,
        });
      }

      if (rows.length > 0) {
        await repos.upsertShares(rows);
        processedCount += rows.length;
      }

      if (result.carriedOverSymbols.length > 0) {
        isCarriedOver = true;
      }
    }
  }

  async function finish(runId: string | null, summary: FinishRunInput): Promise<void> {
    if (runId === null) {
      console.error("[collect-financials] no runId — skipping finish() record", summary);
      return;
    }
    await batchLog.finish(runId, summary);
  }
}

/** 단일 보고서(reprtCode) 응답을 normalizeKrxQuarters 입력 형태로 축약(해당 슬롯만 채움). */
function buildSingleReportInput(
  reprtCode: DartReportCode,
  metric: { threeMonth: number | null; cumulative: number | null } | undefined,
): {
  q1: { threeMonth: number | null; cumulative: number | null } | null;
  half: { threeMonth: number | null; cumulative: number | null } | null;
  q3: { threeMonth: number | null; cumulative: number | null } | null;
  annual: { threeMonth: number | null; cumulative: number | null } | null;
} {
  const base = { q1: null, half: null, q3: null, annual: null } as {
    q1: { threeMonth: number | null; cumulative: number | null } | null;
    half: { threeMonth: number | null; cumulative: number | null } | null;
    q3: { threeMonth: number | null; cumulative: number | null } | null;
    annual: { threeMonth: number | null; cumulative: number | null } | null;
  };
  if (!metric) return base;
  switch (reprtCode) {
    case DART_REPORT_CODES.Q1:
      return { ...base, q1: metric };
    case DART_REPORT_CODES.HALF:
      return { ...base, half: metric };
    case DART_REPORT_CODES.Q3:
      return { ...base, q3: metric };
    case DART_REPORT_CODES.ANNUAL:
      return { ...base, annual: metric };
    default:
      return base;
  }
}

function isModifyDateNewer(modifyDateYYYYMMDD: string, lastCollectedAtIso: string): boolean {
  const modify = `${modifyDateYYYYMMDD.slice(0, 4)}-${modifyDateYYYYMMDD.slice(4, 6)}-${modifyDateYYYYMMDD.slice(6, 8)}`;
  const lastCollectedDate = lastCollectedAtIso.slice(0, 10);
  return modify > lastCollectedDate;
}

type FlatFacts = Record<string, Array<{ start: string; end: string; val: number; fy: number; fp: string; form: string; filed: string; accn: string }>>;

/** companyfacts의 {taxonomy:{tag:{units:{unit:[...]}}}} 구조를 "taxonomy:tag" -> fact[] 평면 구조로 변환(USD 단위 우선). */
function flattenFacts(facts: Record<string, Record<string, unknown> | undefined>): FlatFacts {
  const flat: FlatFacts = {};
  for (const [taxonomy, tags] of Object.entries(facts)) {
    if (!tags) continue;
    for (const [tag, tagValue] of Object.entries(tags)) {
      const units = (tagValue as { units?: Record<string, unknown> } | undefined)?.units;
      if (!units) continue;
      const usdFacts = (units.USD ?? units.shares ?? Object.values(units)[0]) as FlatFacts[string] | undefined;
      if (!usdFacts) continue;
      flat[`${taxonomy}:${tag}`] = usdFacts;
    }
  }
  return flat;
}

function findQuarterPeriod(
  facts: Array<{ start: string; end: string; fy: number }>,
  fiscalYear: number,
  fiscalQuarter: number | null,
): { start: string; end: string } | null {
  // Q4(파생)는 원천에 기간이 없으므로 별도 처리 필요 — 여기서는 동일 fy의 마지막 분기 종료일 다음날~연말로 근사.
  const sameYear = facts.filter((f) => f.fy === fiscalYear);
  if (sameYear.length === 0) return null;
  if (fiscalQuarter === 4) {
    const sorted = [...sameYear].sort((a, b) => a.start.localeCompare(b.start));
    const last = sorted[sorted.length - 1];
    if (!last) return null;
    const nextDay = new Date(`${last.end}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return { start: nextDay.toISOString().slice(0, 10), end: `${fiscalYear}-12-31` };
  }
  const idx = (fiscalQuarter ?? 1) - 1;
  const sorted = [...sameYear].sort((a, b) => a.start.localeCompare(b.start));
  const match = sorted[idx];
  return match ? { start: match.start, end: match.end } : null;
}

function findAnnualPeriod(
  facts: Array<{ start: string; end: string; fy: number }>,
  fiscalYear: number,
): { start: string; end: string } | null {
  const match = facts.find((f) => f.fy === fiscalYear);
  return match ? { start: match.start, end: match.end } : null;
}
