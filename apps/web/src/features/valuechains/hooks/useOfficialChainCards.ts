"use client";

import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";
import { CHAIN_LIST_PAGE_SIZE } from "@iib/domain";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainCardQueryKeys } from "@/features/valuechains/hooks/chainCardQueryKeys";
import { ChainCardListResponseSchema, type ChainCardListResponse } from "@/features/valuechains/lib/dto";

const OFFICIAL_ENDPOINT = "/valuechains/official";
const INITIAL_PAGE_PARAM = 1;

const buildUrl = (page: number, search?: string): string => {
  const params = new URLSearchParams({ page: String(page), limit: String(CHAIN_LIST_PAGE_SIZE) });
  if (search) params.set("search", search);
  return `${OFFICIAL_ENDPOINT}?${params.toString()}`;
};

type UseOfficialChainCardsOptions = {
  /** 체인 이름/포함 종목 부분 일치 검색어 — 공백뿐이면 무시. */
  search?: string;
};

/**
 * 공식 밸류체인 목록 조회 훅 (UC-007 plan 모듈 D-3).
 * 응답을 `ChainCardListResponseSchema`로 런타임 검증한 뒤 캐시에 저장한다(계약 위반 조기 발견).
 */
export function useOfficialChainCards(
  options: UseOfficialChainCardsOptions = {},
): UseInfiniteQueryResult<InfiniteData<ChainCardListResponse>, ApiError> {
  const search = options.search?.trim() || undefined;
  return useInfiniteQuery({
    // 검색어별 캐시 분리 — 기존 [valuechains, official] 프리픽스 무효화는 그대로 동작한다.
    queryKey: [...chainCardQueryKeys.official, { search: search ?? null }],
    queryFn: async ({ pageParam }) => {
      const raw = await apiFetch<ChainCardListResponse>(buildUrl(pageParam, search));
      return ChainCardListResponseSchema.parse(raw);
    },
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
  });
}
