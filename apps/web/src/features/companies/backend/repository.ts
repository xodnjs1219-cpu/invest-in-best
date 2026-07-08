import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketCode } from "@iib/domain";

const TABLE_SECURITIES = "securities";
const TABLE_DAILY_QUOTES = "daily_quotes";
const TABLE_DISCLOSURES = "disclosures";
const TABLE_QUARTERLY_FINANCIALS = "quarterly_financials";
const TABLE_SHARES_OUTSTANDING = "shares_outstanding";
const BELONGING_CHAINS_RPC = "fn_security_belonging_chains";

const SECURITY_WITH_PROFILE_SELECT =
  "id, ticker, name, english_name, market, currency, listing_status, company_profiles(*)";
const SECURITY_BASIC_SELECT = "id, ticker, market, currency, listing_status";

/** Persistence 계층의 통일된 결과 타입 — throw 대신 값으로 성패를 전달한다(UC-008 Result 컨벤션). */
export type RepoResult<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * `features/companies/backend` Persistence 계약(techstack §4) — service.ts는 이 인터페이스에만
 * 의존하고 Supabase 쿼리 문법을 알지 못한다. 전 메서드가 throw 대신 RepoResult를 반환한다.
 */
export type CompaniesRepository = {
  findSecuritiesByTicker: (ticker: string, market: MarketCode | null) => Promise<RepoResult<unknown[]>>;
  findSecurityById: (securityId: string) => Promise<RepoResult<unknown | null>>;
  findLatestQuoteDate: (securityId: string) => Promise<RepoResult<string | null>>;
  findLatestDisclosureDate: (securityId: string) => Promise<RepoResult<string | null>>;
  findQuarterlyFinancials: (
    securityId: string,
    fromYear: number,
    toYear: number,
  ) => Promise<RepoResult<unknown[]>>;
  findDisclosures: (securityId: string, limit: number, offset: number) => Promise<RepoResult<unknown[]>>;
  findDailyQuotes: (securityId: string, from: string, to: string) => Promise<RepoResult<unknown[]>>;
  findRecentShares: (securityId: string, limit: number) => Promise<RepoResult<unknown[]>>;
  findBelongingChains: (securityId: string, ownerId: string | null) => Promise<RepoResult<unknown[]>>;
};

export const createCompaniesRepository = (client: SupabaseClient): CompaniesRepository => ({
  findSecuritiesByTicker: async (ticker, market) => {
    let query = client.from(TABLE_SECURITIES).select(SECURITY_WITH_PROFILE_SELECT).eq("ticker", ticker);
    if (market) {
      query = query.eq("market", market);
    }
    const { data, error } = await query;
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? [] };
  },

  findSecurityById: async (securityId) => {
    const { data, error } = await client
      .from(TABLE_SECURITIES)
      .select(SECURITY_BASIC_SELECT)
      .eq("id", securityId)
      .maybeSingle();
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? null };
  },

  findLatestQuoteDate: async (securityId) => {
    const { data, error } = await client
      .from(TABLE_DAILY_QUOTES)
      .select("trade_date")
      .eq("security_id", securityId)
      .order("trade_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return { ok: false, message: error.message };
    }
    const row = data as { trade_date: string } | null;
    return { ok: true, data: row?.trade_date ?? null };
  },

  findLatestDisclosureDate: async (securityId) => {
    const { data, error } = await client
      .from(TABLE_DISCLOSURES)
      .select("disclosure_date")
      .eq("security_id", securityId)
      .order("disclosure_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return { ok: false, message: error.message };
    }
    const row = data as { disclosure_date: string } | null;
    return { ok: true, data: row?.disclosure_date ?? null };
  },

  findQuarterlyFinancials: async (securityId, fromYear, toYear) => {
    const { data, error } = await client
      .from(TABLE_QUARTERLY_FINANCIALS)
      .select("*")
      .eq("security_id", securityId)
      .gte("fiscal_year", fromYear)
      .lte("fiscal_year", toYear)
      .order("fiscal_year", { ascending: true })
      .order("fiscal_quarter", { ascending: true, nullsFirst: false });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? [] };
  },

  findDisclosures: async (securityId, limit, offset) => {
    const { data, error } = await client
      .from(TABLE_DISCLOSURES)
      .select("*")
      .eq("security_id", securityId)
      .order("disclosure_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? [] };
  },

  findDailyQuotes: async (securityId, from, to) => {
    const { data, error } = await client
      .from(TABLE_DAILY_QUOTES)
      .select("*")
      .eq("security_id", securityId)
      .gte("trade_date", from)
      .lte("trade_date", to)
      .order("trade_date", { ascending: true });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? [] };
  },

  findRecentShares: async (securityId, limit) => {
    const { data, error } = await client
      .from(TABLE_SHARES_OUTSTANDING)
      .select("*")
      .eq("security_id", securityId)
      .order("as_of_date", { ascending: false })
      .limit(limit);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? [] };
  },

  findBelongingChains: async (securityId, ownerId) => {
    const { data, error } = await client.rpc(BELONGING_CHAINS_RPC, {
      p_security_id: securityId,
      p_owner_id: ownerId,
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? [] };
  },
});
