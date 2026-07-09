/**
 * 시세 리포지토리 (docs/usecases/026/plan.md 모듈 14).
 * quote_ticks 멱등 UPSERT·30일 초과 DELETE, daily_quotes 확정 UPSERT·미확정 행 조회, 잠정 집계 RPC 호출.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_UPSERT_CHUNK_SIZE, type MarketCode } from "@iib/domain";
import { fetchAllPages, repoFail, repoOk, type RepoResult } from "./result";

export interface QuoteTickRow {
  securityId: string;
  /** 정시 정규화된 ISO 문자열(observed_at). */
  observedAt: string;
  price: number;
  volume: number | null;
  source: "toss";
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * quote_ticks 멱등 UPSERT — DB_UPSERT_CHUNK_SIZE 청크 반복, ignoreDuplicates:true(동일 정시 재실행 시 기존 행 유지).
 */
export async function upsertTicks(
  client: SupabaseClient,
  rows: QuoteTickRow[],
): Promise<RepoResult<{ upsertedChunks: number }>> {
  const chunks = chunkArray(rows, DB_UPSERT_CHUNK_SIZE);
  let upsertedChunks = 0;

  for (const chunk of chunks) {
    const payload = chunk.map((row) => ({
      security_id: row.securityId,
      observed_at: row.observedAt,
      price: row.price,
      volume: row.volume,
      source: row.source,
    }));
    const { error } = await client
      .from("quote_ticks")
      .upsert(payload, { onConflict: "security_id,observed_at", ignoreDuplicates: true });

    if (error) {
      return repoFail(
        `upsertTicks failed at chunk ${upsertedChunks + 1}/${chunks.length}: ${error.message}`,
      );
    }
    upsertedChunks += 1;
  }

  return repoOk({ upsertedChunks });
}

/** fn_upsert_provisional_daily_quotes RPC 호출(모듈 16) — 갱신 건수 반환. */
export async function upsertProvisionalDaily(
  client: SupabaseClient,
  market: MarketCode,
  tradeDate: string,
  fromUtc: Date,
  toUtc: Date,
): Promise<RepoResult<number>> {
  const { data, error } = await client.rpc("fn_upsert_provisional_daily_quotes", {
    p_market: market,
    p_trade_date: tradeDate,
    p_from: fromUtc.toISOString(),
    p_to: toUtc.toISOString(),
  });

  if (error) {
    return repoFail(`upsertProvisionalDaily failed: ${error.message}`);
  }
  return repoOk((data as number) ?? 0);
}

export interface UnconfirmedDailyTarget {
  securityId: string;
  tossSymbol: string;
}

interface UnconfirmedDailyRow {
  security_id: string;
  securities: { toss_symbol: string; market: MarketCode } | { toss_symbol: string; market: MarketCode }[];
}

export async function findUnconfirmedDaily(
  client: SupabaseClient,
  market: MarketCode,
  tradeDate: string,
): Promise<RepoResult<UnconfirmedDailyTarget[]>> {
  // 시장 전체의 미확정 종목을 반환 — KRX는 상장 종목이 2,000건 이상이라 1,000행 캡에 걸린다.
  // 페이지네이션으로 전량 수집해야 초과분이 종가 확정에서 누락되지 않는다. security_id로 안정 정렬.
  const paged = await fetchAllPages<UnconfirmedDailyRow>(() =>
    client
      .from("daily_quotes")
      .select("security_id, securities!inner(toss_symbol, market)")
      .eq("trade_date", tradeDate)
      .eq("is_closing_confirmed", false)
      .eq("securities.market", market)
      .not("securities.toss_symbol", "is", null)
      .order("security_id", { ascending: true }),
  );
  if (!paged.ok) {
    return repoFail(`findUnconfirmedDaily failed: ${paged.error}`);
  }

  return repoOk(
    paged.data.map((row) => {
      const securities = Array.isArray(row.securities) ? row.securities[0] : row.securities;
      return {
        securityId: row.security_id,
        tossSymbol: securities!.toss_symbol,
      };
    }),
  );
}

export interface ConfirmedDailyRow {
  securityId: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/** 확정 OHLCV + is_closing_confirmed:true를 onConflict:'security_id,trade_date'로 UPSERT(덮어쓰기 — BR-5). */
export async function upsertConfirmedDaily(
  client: SupabaseClient,
  rows: ConfirmedDailyRow[],
): Promise<RepoResult<void>> {
  if (rows.length === 0) return repoOk(undefined);

  const payload = rows.map((row) => ({
    security_id: row.securityId,
    trade_date: row.tradeDate,
    open_price: row.open,
    high_price: row.high,
    low_price: row.low,
    close_price: row.close,
    volume: row.volume,
    is_closing_confirmed: true,
  }));

  const { error } = await client
    .from("daily_quotes")
    .upsert(payload, { onConflict: "security_id,trade_date" });

  if (error) {
    return repoFail(`upsertConfirmedDaily failed: ${error.message}`);
  }
  return repoOk(undefined);
}

/** 보존 기간(30일, 상수) 초과분 정리 — cutoffUtc 미만 삭제 건수 반환(BR-4). */
export async function deleteExpiredTicks(
  client: SupabaseClient,
  cutoffUtc: Date,
): Promise<RepoResult<number>> {
  const { error, count } = await client
    .from("quote_ticks")
    .delete()
    .lt("observed_at", cutoffUtc.toISOString());

  if (error) {
    return repoFail(`deleteExpiredTicks failed: ${error.message}`);
  }
  return repoOk(count ?? 0);
}
