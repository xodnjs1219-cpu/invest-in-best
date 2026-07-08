/**
 * 시세·환율·주식수 리포지토리 (docs/usecases/029/plan.md 모듈 7).
 * daily_quotes/fx_rates/shares_outstanding 범위 조회 + carry-forward 시드 RPC + 정정 워터마크 조회.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IsoDate } from "@iib/domain";
import { repoFail, repoOk, type RepoResult } from "./result";

const PAGE_SIZE = 1000;

export interface DailyClose {
  securityId: string;
  tradeDate: string;
  closePrice: number;
}

/** 종목별 오름차순 정렬 보장(모듈 2 carry-forward 리졸버 입력 계약). `.range()` 페이지네이션 전량 수집. */
export async function findDailyCloses(
  client: SupabaseClient,
  securityIds: string[],
  from: string,
  to: string,
): Promise<RepoResult<DailyClose[]>> {
  if (securityIds.length === 0) return repoOk([]);

  const rows: DailyClose[] = [];
  let page = 0;
  for (;;) {
    const rangeFrom = page * PAGE_SIZE;
    const rangeTo = rangeFrom + PAGE_SIZE - 1;
    const { data, error } = await client
      .from("daily_quotes")
      .select("security_id, trade_date, close_price")
      .in("security_id", securityIds)
      .not("close_price", "is", null)
      .gte("trade_date", from)
      .lte("trade_date", to)
      .order("security_id", { ascending: true })
      .order("trade_date", { ascending: true })
      .range(rangeFrom, rangeTo);

    if (error || !data) {
      return repoFail(`findDailyCloses failed: ${error?.message ?? "no data returned"}`);
    }
    rows.push(
      ...(data as Array<{ security_id: string; trade_date: string; close_price: number }>).map((row) => ({
        securityId: row.security_id,
        tradeDate: row.trade_date,
        closePrice: row.close_price,
      })),
    );
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
  return repoOk(rows);
}

export interface LatestCloseBefore {
  securityId: string;
  tradeDate: string;
  closePrice: number;
}

/** carry-forward 시드(range 시작 이전 마지막 종가) — 모듈 5 RPC 호출. */
export async function findLatestClosesBefore(
  client: SupabaseClient,
  securityIds: string[],
  before: string,
): Promise<RepoResult<LatestCloseBefore[]>> {
  if (securityIds.length === 0) return repoOk([]);

  const { data, error } = await client.rpc("fn_latest_daily_closes_before", {
    p_security_ids: securityIds,
    p_before: before,
  });

  if (error || !data) {
    return repoFail(`findLatestClosesBefore failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(
    (data as Array<{ security_id: string; trade_date: string; close_price: number }>).map((row) => ({
      securityId: row.security_id,
      tradeDate: row.trade_date,
      closePrice: row.close_price,
    })),
  );
}

export interface LatestShares {
  securityId: string;
  shares: number;
  asOfDate: string;
}

/** 종목별 최신 상장주식수 Map(E5) — 모듈 5 RPC 호출. */
export async function findLatestShares(
  client: SupabaseClient,
  securityIds: string[],
): Promise<RepoResult<Map<string, LatestShares>>> {
  if (securityIds.length === 0) return repoOk(new Map());

  const { data, error } = await client.rpc("fn_latest_shares_outstanding", {
    p_security_ids: securityIds,
  });

  if (error || !data) {
    return repoFail(`findLatestShares failed: ${error?.message ?? "no data returned"}`);
  }
  const map = new Map<string, LatestShares>();
  for (const row of data as Array<{ security_id: string; shares: number; as_of_date: string }>) {
    map.set(row.security_id, { securityId: row.security_id, shares: row.shares, asOfDate: row.as_of_date });
  }
  return repoOk(map);
}

export interface FxRateRow {
  rateDate: string;
  rate: number;
}

/** `FX_PAIR`(base/quote) 양방향 필터 + 범위 조회, 종목별 정렬과 동일하게 rate_date 오름차순 보장. */
export async function findFxRates(
  client: SupabaseClient,
  pair: { base: "USD" | "KRW"; quote: "USD" | "KRW" },
  from: string,
  to: string,
): Promise<RepoResult<FxRateRow[]>> {
  const { data, error } = await client
    .from("fx_rates")
    .select("rate_date, rate")
    .eq("base_currency", pair.base)
    .eq("quote_currency", pair.quote)
    .gte("rate_date", from)
    .lte("rate_date", to)
    .order("rate_date", { ascending: true });

  if (error || !data) {
    return repoFail(`findFxRates failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk((data as Array<{ rate_date: string; rate: number }>).map((row) => ({ rateDate: row.rate_date, rate: row.rate })));
}

/** 범위 시작 전 마지막 환율 1건(carry-forward 시드) — 통화쌍 단일이라 RPC 불필요. */
export async function findLatestFxBefore(
  client: SupabaseClient,
  pair: { base: "USD" | "KRW"; quote: "USD" | "KRW" },
  before: string,
): Promise<RepoResult<FxRateRow | null>> {
  const { data, error } = await client
    .from("fx_rates")
    .select("rate_date, rate")
    .eq("base_currency", pair.base)
    .eq("quote_currency", pair.quote)
    .lt("rate_date", before)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ rate_date: string; rate: number }>();

  if (error) {
    return repoFail(`findLatestFxBefore failed: ${error.message}`);
  }
  if (!data) return repoOk(null);
  return repoOk({ rateDate: data.rate_date, rate: data.rate });
}

/** 직전 성공 실행 이후 정정된 daily_quotes 최소 영향 일자(1행 조회 — Open Q1 워터마크). */
export async function findMinCorrectedQuoteDateSince(
  client: SupabaseClient,
  sinceIso: string,
): Promise<RepoResult<IsoDate | null>> {
  const { data, error } = await client
    .from("daily_quotes")
    .select("trade_date")
    .gt("updated_at", sinceIso)
    .order("trade_date", { ascending: true })
    .limit(1)
    .maybeSingle<{ trade_date: string }>();

  if (error) {
    return repoFail(`findMinCorrectedQuoteDateSince failed: ${error.message}`);
  }
  return repoOk(data ? (data.trade_date as IsoDate) : null);
}

/** 직전 성공 실행 이후 정정된 fx_rates 최소 영향 일자(1행 조회). */
export async function findMinCorrectedFxDateSince(
  client: SupabaseClient,
  sinceIso: string,
): Promise<RepoResult<IsoDate | null>> {
  const { data, error } = await client
    .from("fx_rates")
    .select("rate_date")
    .gt("updated_at", sinceIso)
    .order("rate_date", { ascending: true })
    .limit(1)
    .maybeSingle<{ rate_date: string }>();

  if (error) {
    return repoFail(`findMinCorrectedFxDateSince failed: ${error.message}`);
  }
  return repoOk(data ? (data.rate_date as IsoDate) : null);
}

/** 직전 성공 실행 이후 신규/갱신된 shares_outstanding 최소 영향 as_of_date(1행 조회). */
export async function findMinNewSharesAsOfSince(
  client: SupabaseClient,
  sinceIso: string,
): Promise<RepoResult<IsoDate | null>> {
  const { data, error } = await client
    .from("shares_outstanding")
    .select("as_of_date")
    .gt("updated_at", sinceIso)
    .order("as_of_date", { ascending: true })
    .limit(1)
    .maybeSingle<{ as_of_date: string }>();

  if (error) {
    return repoFail(`findMinNewSharesAsOfSince failed: ${error.message}`);
  }
  return repoOk(data ? (data.as_of_date as IsoDate) : null);
}
