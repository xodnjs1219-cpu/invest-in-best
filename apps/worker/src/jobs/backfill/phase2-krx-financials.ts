/**
 * Phase 2 — 국내 과거 재무·공시·주식수 백필 (docs/usecases/031/plan.md 모듈 17).
 * 내부 순서: profiles+shares(2a, 결산월 선확보 R-7) → disclosures(2b, H-10 최근 12개월) → financials(2c, 연도×보고서×청크).
 * OpenDART 020(일일 한도 초과) 감지 시 재시도 없이 즉시 중단하고 이월(E3, BR-7).
 */
import {
  BACKFILL_KRX_DISCLOSURE_MONTHS,
  DART_REPORT_CODES,
  DEFAULT_KRX_SETTLEMENT_MONTH,
  FINANCIALS_MIN_FISCAL_YEAR,
  OPENDART_LIST_WINDOW_DAYS,
  normalizeKrxQuarters,
  resolveCalendarPeriod,
  resolveKrxPeriod,
  type DartReportCode,
} from "@iib/domain";
import {
  DartQuotaExceededError,
  type FetchDisclosuresResult,
  type FetchMultiAccountsResult,
  type KrxAccountSet,
  type KrxCompanyProfile,
  type KrxStockTotal,
} from "../../adapters/opendart/contract";

/** 잡이 필요로 하는 OpenDART 포트의 부분집합(interface segregation — Phase 2는 corpCode 매핑을 다루지 않는다). */
export interface Phase2DartPort {
  fetchCompanyProfile(corpCode: string): Promise<KrxCompanyProfile | null>;
  fetchStockTotal(corpCode: string, bsnsYear: number, reprtCode: string): Promise<KrxStockTotal | null>;
  fetchDisclosures(bgnDe: string, endDe: string): Promise<FetchDisclosuresResult>;
  fetchMultiAccounts(corpCodes: string[], bsnsYear: number, reprtCode: string): Promise<FetchMultiAccountsResult>;
  fetchFullFinancials(corpCode: string, bsnsYear: number, reprtCode: string): Promise<KrxAccountSet | null>;
}
import type { RepoResult } from "../../repositories/result";
import type { CompanyProfileRow } from "../../repositories/company-profiles.repository";
import type { DisclosureRow } from "../../repositories/disclosures.repository";
import type { FinancialsRow } from "../../repositories/financials.repository";
import type { SharesRow } from "../../repositories/shares.repository";

export interface Phase2Target {
  id: string;
  dartCorpCode: string;
  ticker?: string;
}

export interface Phase2Repos {
  upsertProfiles(rows: CompanyProfileRow[]): Promise<RepoResult<void>>;
  upsertShares(rows: SharesRow[]): Promise<RepoResult<void>>;
  upsertDisclosures(rows: DisclosureRow[]): Promise<RepoResult<void>>;
  upsertFinancials(rows: FinancialsRow[]): Promise<RepoResult<{ affected: number; failedChunks: number }>>;
}

export interface Phase2Checkpoints {
  get(key: string): Promise<RepoResult<{ cursor: unknown; isCompleted: boolean } | null>>;
  upsert(key: string, cursor: unknown, isCompleted: boolean): Promise<RepoResult<void>>;
  complete(key: string): Promise<RepoResult<void>>;
}

export interface Phase2Guard {
  waitUntilIdle(runId: string): Promise<void>;
}

export interface Phase2BatchLog {
  itemFailures(failures: Array<{ securityId: string; attemptCount: number; lastError: string }>): Promise<void>;
}

export interface Phase2Deps {
  dart: Phase2DartPort;
  repos: Phase2Repos;
  checkpoints: Phase2Checkpoints;
  guard: Phase2Guard;
  batchLog: Phase2BatchLog;
  /** 테스트 주입용 — 기본은 MIN_FISCAL_YEAR..현재 사업연도. */
  fiscalYears?: number[];
}

export interface Phase2Summary {
  processed: number;
  failed: number;
  carriedOver: boolean;
}

export interface Phase2Job {
  run(targets: Phase2Target[], now?: Date): Promise<Phase2Summary>;
}

/** 단일 보고서(reprtCode) 응답을 normalizeKrxQuarters 입력으로 축약(UC-027 collect-financials.job.ts와 동일 패턴). */
function buildSingleReportInput(
  reprtCode: DartReportCode,
  metric: { threeMonth: number | null; cumulative: number | null } | undefined,
) {
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

function defaultFiscalYears(now: Date): number[] {
  const currentYear = now.getUTCFullYear();
  const years: number[] = [];
  for (let y = FINANCIALS_MIN_FISCAL_YEAR; y <= currentYear; y++) {
    years.push(y);
  }
  return years;
}

/** 최근 N개월을 OPENDART_LIST_WINDOW_DAYS(85일) 이하 구간으로 분할(H-10, list.json 3개월 제한 대응). */
function buildDisclosureWindows(now: Date, months: number): Array<{ bgnDe: string; endDe: string }> {
  const fmt = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - months);

  const windows: Array<{ bgnDe: string; endDe: string }> = [];
  let cursor = new Date(start);
  while (cursor < now) {
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + OPENDART_LIST_WINDOW_DAYS);
    const end = windowEnd < now ? windowEnd : now;
    windows.push({ bgnDe: fmt(cursor), endDe: fmt(end) });
    cursor = new Date(end);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return windows;
}

export function createPhase2KrxFinancials(deps: Phase2Deps): Phase2Job {
  const { dart, repos, checkpoints, guard, batchLog } = deps;

  return {
    async run(targets: Phase2Target[], now: Date = new Date()): Promise<Phase2Summary> {
      let processed = 0;
      let failed = 0;
      let carriedOver = false;
      const settlementMonthByCorp = new Map<string, number>();

      try {
        // [2a] profiles + shares — 결산월 선확보(R-7).
        await guard.waitUntilIdle("backfill");
        const profileRows: CompanyProfileRow[] = [];
        const sharesRows: SharesRow[] = [];
        for (const target of targets) {
          const profile = await dart.fetchCompanyProfile(target.dartCorpCode);
          if (profile !== null) {
            profileRows.push({
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
          // acc_mt(결산월)는 KrxCompanyProfile 계약에 없으므로 기본값 사용(외부 응답 확장 시 갱신 지점).
          settlementMonthByCorp.set(target.dartCorpCode, DEFAULT_KRX_SETTLEMENT_MONTH);

          const primaryYear = now.getUTCFullYear() - 1;
          const stockTotal = await dart.fetchStockTotal(target.dartCorpCode, primaryYear, DART_REPORT_CODES.ANNUAL);
          if (stockTotal !== null) {
            sharesRows.push({
              securityId: target.id,
              shares: stockTotal.totalShares,
              asOfDate: stockTotal.settlementDate,
              source: "dart",
              sourceTag: "istc_totqy",
              isMultiClassPartial: false,
            });
          }
        }
        if (profileRows.length > 0) {
          await repos.upsertProfiles(profileRows);
          processed += profileRows.length;
        }
        if (sharesRows.length > 0) {
          await repos.upsertShares(sharesRows);
          processed += sharesRows.length;
        }

        // [2b] disclosures — 최근 12개월(H-10), 85일 구간 분할.
        await guard.waitUntilIdle("backfill");
        const tickerToSecurity = new Map(targets.filter((t) => t.ticker).map((t) => [t.ticker!, t]));
        const windows = buildDisclosureWindows(now, BACKFILL_KRX_DISCLOSURE_MONTHS);
        for (const w of windows) {
          const result = await dart.fetchDisclosures(w.bgnDe, w.endDe);
          const rows: DisclosureRow[] = [];
          for (const item of result.items) {
            const target = tickerToSecurity.get(item.stockCode);
            if (!target) continue;
            rows.push({
              securityId: target.id,
              source: "dart",
              externalId: item.rceptNo,
              title: item.title,
              disclosureDate: item.disclosureDate,
              url: item.url,
            });
          }
          if (rows.length > 0) {
            await repos.upsertDisclosures(rows);
            processed += rows.length;
          }
        }

        // [2c] financials — 사업연도×보고서코드×100사 청크.
        await guard.waitUntilIdle("backfill");
        const fiscalYears = deps.fiscalYears ?? defaultFiscalYears(now);
        const reportCodes: DartReportCode[] = [
          DART_REPORT_CODES.Q1,
          DART_REPORT_CODES.HALF,
          DART_REPORT_CODES.Q3,
          DART_REPORT_CODES.ANNUAL,
        ];
        const corpCodeToTarget = new Map(targets.map((t) => [t.dartCorpCode, t]));

        for (const fiscalYear of fiscalYears) {
          // corp x report 결과를 모아 4종 세트 완료 시 정규화(구현 단순화 — plan.md 모듈 17.3).
          const accountsByCorp = new Map<string, Record<string, KrxAccountSet | undefined>>();

          for (const reprtCode of reportCodes) {
            await guard.waitUntilIdle("backfill");
            const corpCodes = targets.map((t) => t.dartCorpCode);
            const { accounts } = await dart.fetchMultiAccounts(corpCodes, fiscalYear, reprtCode);
            for (const account of accounts) {
              const byReport = accountsByCorp.get(account.corpCode) ?? {};
              byReport[reprtCode] = account;
              accountsByCorp.set(account.corpCode, byReport);
            }
          }

          const rows: FinancialsRow[] = [];
          for (const [corpCode, byReport] of accountsByCorp) {
            const target = corpCodeToTarget.get(corpCode);
            if (!target) continue;
            const settlementMonth = settlementMonthByCorp.get(corpCode) ?? DEFAULT_KRX_SETTLEMENT_MONTH;

            for (const reprtCode of reportCodes) {
              const account = byReport[reprtCode];
              if (!account) continue;
              if (fiscalYear < FINANCIALS_MIN_FISCAL_YEAR) continue;

              const period = resolveKrxPeriod(fiscalYear, reprtCode, settlementMonth === 12 ? 12 : settlementMonth);
              const single = buildSingleReportInput(reprtCode, account.metrics.revenue);
              const normalized = normalizeKrxQuarters({ fiscalYear, metric: "revenue", ...single });

              for (const row of normalized) {
                const rowPeriod =
                  row.periodType === "annual"
                    ? { start: `${fiscalYear}-01-01`, end: `${fiscalYear}-12-31` }
                    : period;
                const calendar = resolveCalendarPeriod(rowPeriod.start, rowPeriod.end, row.periodType);
                rows.push({
                  securityId: target.id,
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
          }

          if (rows.length > 0) {
            const upsertResult = await repos.upsertFinancials(rows);
            if (upsertResult.ok) {
              processed += upsertResult.data.affected;
              failed += upsertResult.data.failedChunks;
            }
          }

          // 연도 단위 적재 성공 후에만 체크포인트를 완료 처리한다(BR-6 — 적재-커서 정합, 재개 시 재조회 방지).
          await checkpoints.upsert(`phase2:financials:${fiscalYear}`, { fiscalYear }, true);
        }
      } catch (error) {
        if (error instanceof DartQuotaExceededError) {
          carriedOver = true;
        } else {
          failed += 1;
          await batchLog.itemFailures([{ securityId: "unknown", attemptCount: 1, lastError: (error as Error).message }]);
        }
      }

      return { processed, failed, carriedOver };
    },
  };
}
