import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketCode } from "@iib/domain";

const SEARCH_SECURITIES_RPC = "search_securities";

export type SecuritiesSearchByTextParams = {
  /** 정규화 완료된 검색어(서비스 계층에서 정규화 후 전달). */
  query: string;
  market: MarketCode | null;
  /** 서비스가 pageSize+1을 전달한다(hasMore 산출용, COUNT 쿼리 불필요). */
  limit: number;
  offset: number;
};

export type SecuritiesSearchByTextResult =
  | { ok: true; rows: unknown[] }
  | { ok: false; message: string };

/**
 * `securities` 부분 일치 검색 접근을 캡슐화하는 계약(Persistence).
 * service.ts는 이 인터페이스에만 의존하고 Supabase 쿼리 문법을 알지 못한다(techstack §4).
 */
export type SecuritiesSearchRepository = {
  searchByText: (params: SecuritiesSearchByTextParams) => Promise<SecuritiesSearchByTextResult>;
};

/**
 * `client.rpc('search_securities', ...)` 호출을 캡슐화한 구현.
 * Supabase 오류는 예외를 던지지 않고 `{ ok: false, message }` 값으로 반환한다(가이드라인).
 */
export const createSecuritiesSearchRepository = (
  client: SupabaseClient,
): SecuritiesSearchRepository => ({
  searchByText: async ({ query, market, limit, offset }) => {
    const { data, error } = await client.rpc(SEARCH_SECURITIES_RPC, {
      p_query: query,
      p_limit: limit,
      p_offset: offset,
      p_market: market,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, rows: data ?? [] };
  },
});

// ============================================================================
// UC-018: 저장 시 securityId 존재 검증 (plan 모듈 12 — 사용자/공식 저장 service 공용)
// ============================================================================

const SECURITIES_TABLE = "securities";

export type FindExistingSecurityIdsResult = { foundIds: Set<string> } | { error: string };

/**
 * `nodes[].securityId` ∪ `focusSecurityId` 존재 확인(E12·S-9). 빈 입력이면 쿼리를 생략하고
 * 즉시 빈 Set을 반환한다(방어적 — 불필요 쿼리 제거).
 */
export const findExistingSecurityIds = async (
  client: SupabaseClient,
  ids: string[],
): Promise<FindExistingSecurityIdsResult> => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return { foundIds: new Set() };
  }

  const { data, error } = await client.from(SECURITIES_TABLE).select("id").in("id", uniqueIds);

  if (error) {
    return { error: error.message };
  }

  return { foundIds: new Set((data ?? []).map((row) => (row as { id: string }).id)) };
};
