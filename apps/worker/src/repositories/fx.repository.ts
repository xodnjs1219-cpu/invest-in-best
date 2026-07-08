/**
 * 환율 리포지토리 (docs/usecases/028/plan.md 모듈 6).
 * fx_rates 멱등 UPSERT((rate_date, base_currency, quote_currency) 충돌 시 갱신) + 최신 1건 SELECT
 * (환율 스텝 실패 시 직전 관측값 존재 여부를 error_log에 남기기 위한 조회용).
 * 1행/일 처리라 청크 분할 불필요.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface FxRateRow {
  rateDate: string;
  baseCurrency: "USD" | "KRW";
  quoteCurrency: "USD" | "KRW";
  rate: number;
  source: "dart" | "sec" | "toss";
}

export async function upsertRate(client: SupabaseClient, row: FxRateRow): Promise<RepoResult<void>> {
  const { error } = await client.from("fx_rates").upsert(
    {
      rate_date: row.rateDate,
      base_currency: row.baseCurrency,
      quote_currency: row.quoteCurrency,
      rate: row.rate,
      source: row.source,
    },
    { onConflict: "rate_date,base_currency,quote_currency" },
  );

  if (error) {
    return repoFail(`upsertRate failed: ${error.message}`);
  }
  return repoOk(undefined);
}

export interface LatestFxRate {
  rateDate: string;
  rate: number;
}

export async function findLatestRate(
  client: SupabaseClient,
  baseCurrency: "USD" | "KRW",
  quoteCurrency: "USD" | "KRW",
): Promise<RepoResult<LatestFxRate | null>> {
  const { data, error } = await client
    .from("fx_rates")
    .select("rate_date, rate")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", quoteCurrency)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ rate_date: string; rate: number }>();

  if (error) {
    return repoFail(`findLatestRate failed: ${error.message}`);
  }
  if (!data) {
    return repoOk(null);
  }
  return repoOk({ rateDate: data.rate_date, rate: data.rate });
}
