"use client";

import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";
import { CHAIN_LIST_PAGE_SIZE } from "@iib/domain";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainCardQueryKeys } from "@/features/valuechains/hooks/chainCardQueryKeys";
import { ChainCardListResponseSchema, type ChainCardListResponse } from "@/features/valuechains/lib/dto";

const OFFICIAL_ENDPOINT = "/valuechains/official";
const INITIAL_PAGE_PARAM = 1;

const buildUrl = (page: number): string =>
  `${OFFICIAL_ENDPOINT}?${new URLSearchParams({ page: String(page), limit: String(CHAIN_LIST_PAGE_SIZE) }).toString()}`;

/**
 * 공식 밸류체인 목록 조회 훅 (UC-007 plan 모듈 D-3).
 * 응답을 `ChainCardListResponseSchema`로 런타임 검증한 뒤 캐시에 저장한다(계약 위반 조기 발견).
 */
export function useOfficialChainCards(): UseInfiniteQueryResult<
  InfiniteData<ChainCardListResponse>,
  ApiError
> {
  return useInfiniteQuery({
    queryKey: chainCardQueryKeys.official,
    queryFn: async ({ pageParam }) => {
      const raw = await apiFetch<ChainCardListResponse>(buildUrl(pageParam));
      return ChainCardListResponseSchema.parse(raw);
    },
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
  });
}
