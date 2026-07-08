"use client";

import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import type { SecuritySearchResponse } from "@/features/securities/lib/dto";
import type { MarketFilter } from "@/features/explore/state/exploreReducer";

const SEARCH_ENDPOINT = "/securities/search";
const INITIAL_PAGE_PARAM = 1;

type UseSecuritiesSearchParams = {
  query: string;
  market: MarketFilter;
};

type UseSecuritiesSearchOptions = {
  enabled: boolean;
};

const buildSearchUrl = (params: UseSecuritiesSearchParams, page: number): string => {
  const searchParams = new URLSearchParams({ q: params.query, page: String(page) });
  if (params.market !== "ALL") {
    searchParams.set("market", params.market);
  }
  return `${SEARCH_ENDPOINT}?${searchParams.toString()}`;
};

/**
 * UC-008 통합 종목 검색 서버 상태 훅 (state_management.md §6 계약).
 * 쿼리 키에 query/market이 참여해 변경 시 자동으로 1페이지부터 재조회한다.
 * `market='ALL'`이면 market 쿼리 파라미터를 전송하지 않는다(전체 검색).
 */
export function useSecuritiesSearch(
  params: UseSecuritiesSearchParams,
  options: UseSecuritiesSearchOptions,
): UseInfiniteQueryResult<InfiniteData<SecuritySearchResponse>> {
  return useInfiniteQuery({
    queryKey: ["securities", "search", { query: params.query, market: params.market }] as const,
    queryFn: ({ pageParam }) =>
      apiFetch<SecuritySearchResponse>(buildSearchUrl(params, pageParam)),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: options.enabled,
  });
}
