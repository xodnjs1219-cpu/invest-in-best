/**
 * 캘린더 리포지토리 (docs/usecases/026/plan.md 모듈 14).
 * 시장·현지일자별 market_calendar 1행 SELECT. 없으면 null(E9 판정 입력).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketCode } from "@iib/domain";
import type { MarketCalendarSession } from "@iib/domain";
import { repoFail, repoOk, type RepoResult } from "./result";

interface MarketCalendarRow {
  is_trading_day: boolean;
  open_at: string | null;
  close_at: string | null;
}

export async function findByMarketDate(
  client: SupabaseClient,
  market: MarketCode,
  localDate: string,
): Promise<RepoResult<MarketCalendarSession | null>> {
  const { data, error } = await client
    .from("market_calendar")
    .select("is_trading_day, open_at, close_at")
    .eq("market", market)
    .eq("calendar_date", localDate)
    .maybeSingle<MarketCalendarRow>();

  if (error) {
    return repoFail(`findByMarketDate failed: ${error.message}`);
  }
  if (!data) {
    return repoOk(null);
  }
  return repoOk({
    isTradingDay: data.is_trading_day,
    openAt: data.open_at ? new Date(data.open_at) : null,
    closeAt: data.close_at ? new Date(data.close_at) : null,
  });
}

/**
 * 캘린더 적재 입력(docs/usecases/028/plan.md 모듈 7) — UC-028 collect-fx-market-hours 전용 쓰기 경로.
 * 026(findByMarketDate)은 읽기 전용, 본 잡이 유일한 쓰기 주체.
 */
export interface UpsertCalendarDayInput {
  market: MarketCode;
  calendarDate: string;
  isTradingDay: boolean;
  openAt: Date | null;
  closeAt: Date | null;
  isEarlyClose: boolean;
}

/**
 * market_calendar 값 갱신형 UPSERT(onConflict:'market,calendar_date') — 당일·익일 캐시 갱신(spec Main 8).
 * 빈 배열이면 DB 호출 없이 {ok:true, count:0}.
 */
export async function upsertDays(
  client: SupabaseClient,
  rows: UpsertCalendarDayInput[],
): Promise<RepoResult<{ count: number }>> {
  if (rows.length === 0) return repoOk({ count: 0 });

  const { error } = await client.from("market_calendar").upsert(
    rows.map((row) => ({
      market: row.market,
      calendar_date: row.calendarDate,
      is_trading_day: row.isTradingDay,
      open_at: row.openAt ? row.openAt.toISOString() : null,
      close_at: row.closeAt ? row.closeAt.toISOString() : null,
      is_early_close: row.isEarlyClose,
      source: "toss",
    })),
    { onConflict: "market,calendar_date" },
  );

  if (error) {
    return repoFail(`upsertDays failed: ${error.message}`);
  }
  return repoOk({ count: rows.length });
}
