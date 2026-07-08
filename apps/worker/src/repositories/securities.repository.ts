/**
 * 종목 리포지토리 (docs/usecases/026/plan.md 모듈 14).
 * 수집 대상 종목 SELECT — listing_status='listed' + 개장 시장 + toss_symbol IS NOT NULL(BR-3, 결정 H-5, E7).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketCode } from "@iib/domain";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface CollectTargetSecurity {
  id: string;
  tossSymbol: string;
  market: MarketCode;
  currency: string;
}

interface SecurityRow {
  id: string;
  toss_symbol: string;
  market: MarketCode;
  currency: string;
}

export async function findCollectTargets(
  client: SupabaseClient,
  markets: MarketCode[],
): Promise<RepoResult<CollectTargetSecurity[]>> {
  const { data, error } = await client
    .from("securities")
    .select("id, toss_symbol, market, currency")
    .in("market", markets)
    .eq("listing_status", "listed")
    .not("toss_symbol", "is", null);

  if (error || !data) {
    return repoFail(`findCollectTargets failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(
    (data as SecurityRow[]).map((row) => ({
      id: row.id,
      tossSymbol: row.toss_symbol,
      market: row.market,
      currency: row.currency,
    })),
  );
}
