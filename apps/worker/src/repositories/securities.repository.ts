/**
 * 종목 리포지토리 (docs/usecases/026/plan.md 모듈 14, docs/usecases/031/plan.md 모듈 3 확장).
 * 수집 대상 종목 SELECT — listing_status='listed' + 개장 시장 + toss_symbol IS NOT NULL(BR-3, 결정 H-5, E7).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_UPSERT_CHUNK_SIZE, type MarketCode } from "@iib/domain";
import { fetchAllPages, repoFail, repoOk, type RepoResult } from "./result";

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

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
  const paged = await fetchAllPages<SecurityRow>(() =>
    client
      .from("securities")
      .select("id, toss_symbol, market, currency")
      .in("market", markets)
      .eq("listing_status", "listed")
      .not("toss_symbol", "is", null),
  );
  if (!paged.ok) {
    return repoFail(`findCollectTargets failed: ${paged.error}`);
  }
  return repoOk(
    paged.data.map((row) => ({
      id: row.id,
      tossSymbol: row.toss_symbol,
      market: row.market,
      currency: row.currency,
    })),
  );
}

/**
 * UC-027(collect-financials) 모듈 12 확장.
 * 전 종목 로드(밸류체인 편입 여부 무관, BR-2) — delisted는 제외, suspended는 포함(E20).
 */
export interface FinancialsTargetSecurity {
  id: string;
  ticker: string;
  market: MarketCode;
  listingStatus: string;
  dartCorpCode: string | null;
  cik: string | null;
  tossSymbol: string | null;
  sharesManualOverrideNeeded: boolean;
}

interface FinancialsTargetRow {
  id: string;
  ticker: string;
  market: MarketCode;
  listing_status: string;
  dart_corp_code: string | null;
  cik: string | null;
  toss_symbol: string | null;
  shares_manual_override_needed: boolean;
}

export async function findAllForFinancials(
  client: SupabaseClient,
): Promise<RepoResult<FinancialsTargetSecurity[]>> {
  const paged = await fetchAllPages<FinancialsTargetRow>(() =>
    client
      .from("securities")
      .select("id, ticker, market, listing_status, dart_corp_code, cik, toss_symbol, shares_manual_override_needed")
      .neq("listing_status", "delisted"),
  );
  if (!paged.ok) {
    return repoFail(`findAllForFinancials failed: ${paged.error}`);
  }
  return repoOk(
    paged.data.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      market: row.market,
      listingStatus: row.listing_status,
      dartCorpCode: row.dart_corp_code,
      cik: row.cik,
      tossSymbol: row.toss_symbol,
      sharesManualOverrideNeeded: row.shares_manual_override_needed,
    })),
  );
}

export interface DartCorpCodeUpdate {
  ticker: string;
  dartCorpCode: string;
}

/** KRX 종목 dart_corp_code 매핑 갱신(변경분만 — 잡이 사전 diff). */
export async function updateDartCorpCodes(
  client: SupabaseClient,
  rows: DartCorpCodeUpdate[],
): Promise<RepoResult<void>> {
  if (rows.length === 0) return repoOk(undefined);

  for (const row of rows) {
    const { error } = await client
      .from("securities")
      .update({ dart_corp_code: row.dartCorpCode })
      .eq("ticker", row.ticker);
    if (error) {
      return repoFail(`updateDartCorpCodes failed for ticker ${row.ticker}: ${error.message}`);
    }
  }
  return repoOk(undefined);
}

export interface SecurityTickerRow {
  id: string;
  market: MarketCode;
  ticker: string;
}

/**
 * 전 종목 id/market/ticker 조회(UC-031 Phase 0 — 토스 stocks 응답 매칭·shares_outstanding 적재용 id 해석).
 */
export async function findAllTickers(client: SupabaseClient): Promise<RepoResult<SecurityTickerRow[]>> {
  const paged = await fetchAllPages<SecurityTickerRow>(() => client.from("securities").select("id, market, ticker"));
  if (!paged.ok) {
    return repoFail(`findAllTickers failed: ${paged.error}`);
  }
  return repoOk(paged.data);
}

/**
 * Phase 0 종목 마스터 시드·보강용 부분 UPSERT 행(docs/usecases/031/plan.md 모듈 3).
 * 소스별로 채우는 컬럼만 포함해야 한다 — row에 없는 키는 UPSERT 페이로드에서 완전히 생략되어
 * 다른 소스가 이미 채워둔 컬럼을 null로 덮어쓰지 않는다(교차 오염 방지, E14).
 */
export interface SecuritySeedRow {
  market: MarketCode;
  ticker: string;
  name?: string;
  englishName?: string;
  currency?: "KRW" | "USD";
  dartCorpCode?: string;
  cik?: string;
  tossSymbol?: string;
  isinCode?: string;
  securityType?: string;
  listingStatus?: string;
  listDate?: string | null;
  delistDate?: string | null;
}

function toSeedPayload(row: SecuritySeedRow): Record<string, unknown> {
  const payload: Record<string, unknown> = { market: row.market, ticker: row.ticker };
  if (row.name !== undefined) payload.name = row.name;
  if (row.englishName !== undefined) payload.english_name = row.englishName;
  if (row.currency !== undefined) payload.currency = row.currency;
  if (row.dartCorpCode !== undefined) payload.dart_corp_code = row.dartCorpCode;
  if (row.cik !== undefined) payload.cik = row.cik;
  if (row.tossSymbol !== undefined) payload.toss_symbol = row.tossSymbol;
  if (row.isinCode !== undefined) payload.isin_code = row.isinCode;
  if (row.securityType !== undefined) payload.security_type = row.securityType;
  if (row.listingStatus !== undefined) payload.listing_status = row.listingStatus;
  if (row.listDate !== undefined) payload.list_date = row.listDate;
  if (row.delistDate !== undefined) payload.delist_date = row.delistDate;
  return payload;
}

/**
 * Phase 0(종목 마스터 시드·보강) 전용 UPSERT — `onConflict:'market,ticker'`(uq_securities_market_ticker).
 * DB_UPSERT_CHUNK_SIZE 청크로 반복 호출한다(BR-2, techstack §7).
 */
export async function upsertSecuritySeeds(
  client: SupabaseClient,
  rows: SecuritySeedRow[],
): Promise<RepoResult<void>> {
  if (rows.length === 0) return repoOk(undefined);

  for (const c of chunkArray(rows, DB_UPSERT_CHUNK_SIZE)) {
    const { error } = await client
      .from("securities")
      .upsert(c.map(toSeedPayload), { onConflict: "market,ticker" });
    if (error) {
      return repoFail(`upsertSecuritySeeds failed: ${error.message}`);
    }
  }
  return repoOk(undefined);
}

/** SEC 상장주식수 폴백 4단계 전부 실패한 종목 표식(E12) — 자동 수집 제외 대상. */
export async function flagSharesManualOverride(
  client: SupabaseClient,
  securityIds: string[],
): Promise<RepoResult<void>> {
  if (securityIds.length === 0) return repoOk(undefined);

  const { error } = await client
    .from("securities")
    .update({ shares_manual_override_needed: true })
    .in("id", securityIds);

  if (error) {
    return repoFail(`flagSharesManualOverride failed: ${error.message}`);
  }
  return repoOk(undefined);
}
