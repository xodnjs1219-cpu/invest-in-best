/**
 * 재무 리포지토리 (docs/usecases/027/plan.md 모듈 12, docs/usecases/029/plan.md 모듈 7 확장).
 * fn_upsert_quarterly_financials RPC 청크 호출, 기존 (year,quarter) 적재 여부 조회(폴백 판정용),
 * 역년 축 분기 매출 조회·연간 전용 판별·정정 워터마크 조회(집계 배치 029 입력).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_UPSERT_CHUNK_SIZE, type IsoDate } from "@iib/domain";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface FinancialsRow {
  securityId: string;
  periodType: "quarter" | "annual";
  fiscalYear: number;
  fiscalQuarter: number | null;
  periodStartDate: string | null;
  periodEndDate: string | null;
  calendarYear: number | null;
  calendarQuarter: number | null;
  currency: "KRW" | "USD";
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  amountBasis: "three_month" | "derived_from_cumulative" | null;
  revenueSourceTag: string | null;
  isRevenueTagUnmapped: boolean;
  source: "dart" | "sec" | "toss";
  disclosureRceptNo: string | null;
}

function toRpcRow(row: FinancialsRow): Record<string, unknown> {
  return {
    security_id: row.securityId,
    period_type: row.periodType,
    fiscal_year: row.fiscalYear,
    fiscal_quarter: row.fiscalQuarter,
    period_start_date: row.periodStartDate,
    period_end_date: row.periodEndDate,
    calendar_year: row.calendarYear,
    calendar_quarter: row.calendarQuarter,
    currency: row.currency,
    revenue: row.revenue,
    operating_income: row.operatingIncome,
    net_income: row.netIncome,
    amount_basis: row.amountBasis,
    revenue_source_tag: row.revenueSourceTag,
    is_revenue_tag_unmapped: row.isRevenueTagUnmapped,
    source: row.source,
    disclosure_rcept_no: row.disclosureRceptNo,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface UpsertFinancialsSummary {
  affected: number;
  failedChunks: number;
}

/** DB_UPSERT_CHUNK_SIZE 청크로 RPC 반복 호출, 변경 행 수 합산·실패 청크 수 집계(throw 없음). */
export async function upsertFinancials(
  client: SupabaseClient,
  rows: FinancialsRow[],
): Promise<RepoResult<UpsertFinancialsSummary>> {
  let affected = 0;
  let failedChunks = 0;

  for (const c of chunk(rows, DB_UPSERT_CHUNK_SIZE)) {
    const { data, error } = await client.rpc("fn_upsert_quarterly_financials", {
      p_rows: c.map(toRpcRow),
    });
    if (error || data === null || data === undefined) {
      failedChunks += 1;
      continue;
    }
    affected += data as number;
  }

  return repoOk({ affected, failedChunks });
}

/** 해당 기간 기적재 종목 집합(singlAcntAll 폴백 대상 판정 — 반복 호출로 한도 낭비 방지). */
export async function findExistingPeriodKeys(
  client: SupabaseClient,
  securityIds: string[],
  fiscalYear: number,
  fiscalQuarter?: number,
): Promise<RepoResult<Set<string>>> {
  let query = client
    .from("quarterly_financials")
    .select("security_id")
    .in("security_id", securityIds)
    .eq("fiscal_year", fiscalYear);

  if (fiscalQuarter !== undefined) {
    query = query.eq("fiscal_quarter", fiscalQuarter);
  }

  const { data, error } = await query;
  if (error || !data) {
    return repoFail(`findExistingPeriodKeys failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(new Set((data as Array<{ security_id: string }>).map((r) => r.security_id)));
}

export interface QuarterRevenueRow {
  securityId: string;
  revenue: number | null;
  currency: "KRW" | "USD";
  isRevenueTagUnmapped: boolean;
}

/**
 * 역년 축(calendar_year/calendar_quarter) 분기 매출 조회(BR 6.1 — 회계 축 아님, UC-029 모듈 7).
 * `period_type='quarter'` 행만 대상.
 */
export async function findQuarterRevenues(
  client: SupabaseClient,
  securityIds: string[],
  year: number,
  quarter: number,
): Promise<RepoResult<QuarterRevenueRow[]>> {
  if (securityIds.length === 0) return repoOk([]);

  const { data, error } = await client
    .from("quarterly_financials")
    .select("security_id, revenue, currency, is_revenue_tag_unmapped")
    .in("security_id", securityIds)
    .eq("period_type", "quarter")
    .eq("calendar_year", year)
    .eq("calendar_quarter", quarter);

  if (error || !data) {
    return repoFail(`findQuarterRevenues failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(
    (data as Array<{ security_id: string; revenue: number | null; currency: "KRW" | "USD"; is_revenue_tag_unmapped: boolean }>).map(
      (row) => ({
        securityId: row.security_id,
        revenue: row.revenue,
        currency: row.currency,
        isRevenueTagUnmapped: row.is_revenue_tag_unmapped,
      }),
    ),
  );
}

/**
 * 연간 전용(20-F 등, `period_type='annual'`) 판별 — 해당 분기와 기간이 겹치는 행의 security_id 집합(E8).
 * 기간 결측 행(`period_start_date`/`period_end_date` NULL)은 `fiscal_year=year` 폴백으로 판별한다.
 */
export async function findAnnualOnlySecurities(
  client: SupabaseClient,
  securityIds: string[],
  year: number,
  quarterStart: IsoDate,
  quarterEnd: IsoDate,
): Promise<RepoResult<Set<string>>> {
  if (securityIds.length === 0) return repoOk(new Set());

  const { data, error } = await client
    .from("quarterly_financials")
    .select("security_id, period_start_date, period_end_date, fiscal_year")
    .in("security_id", securityIds)
    .eq("period_type", "annual")
    .or(
      `and(period_start_date.lte.${quarterEnd},period_end_date.gte.${quarterStart}),and(period_start_date.is.null,period_end_date.is.null,fiscal_year.eq.${year})`,
    );

  if (error || !data) {
    return repoFail(`findAnnualOnlySecurities failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(new Set((data as Array<{ security_id: string }>).map((r) => r.security_id)));
}

/** 직전 성공 실행 이후 정정된 quarterly_financials(period_type='quarter') 최소 영향 (year,quarter)(E6 워터마크). */
export async function findMinCorrectedQuarterSince(
  client: SupabaseClient,
  sinceIso: string,
): Promise<RepoResult<{ year: number; quarter: number } | null>> {
  const { data, error } = await client
    .from("quarterly_financials")
    .select("calendar_year, calendar_quarter")
    .eq("period_type", "quarter")
    .gt("updated_at", sinceIso)
    .order("calendar_year", { ascending: true })
    .order("calendar_quarter", { ascending: true })
    .limit(1)
    .maybeSingle<{ calendar_year: number; calendar_quarter: number }>();

  if (error) {
    return repoFail(`findMinCorrectedQuarterSince failed: ${error.message}`);
  }
  if (!data) return repoOk(null);
  return repoOk({ year: data.calendar_year, quarter: data.calendar_quarter });
}
