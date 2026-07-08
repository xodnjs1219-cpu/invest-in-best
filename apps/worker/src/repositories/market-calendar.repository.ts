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
