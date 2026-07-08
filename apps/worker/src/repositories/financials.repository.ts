/**
 * 재무 리포지토리 (docs/usecases/027/plan.md 모듈 12).
 * fn_upsert_quarterly_financials RPC 청크 호출, 기존 (year,quarter) 적재 여부 조회(폴백 판정용).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_UPSERT_CHUNK_SIZE } from "@iib/domain";
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
