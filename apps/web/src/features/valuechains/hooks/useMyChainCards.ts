"use client";

import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";
import { CHAIN_LIST_PAGE_SIZE } from "@iib/domain";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainCardQueryKeys } from "@/features/valuechains/hooks/chainCardQueryKeys";
import { ChainCardListResponseSchema, type ChainCardListResponse } from "@/features/valuechains/lib/dto";

const MINE_ENDPOINT = "/valuechains/mine";
const INITIAL_PAGE_PARAM = 1;
/** 401(세션 만료/무인증)은 재시도 금지 — 결과가 바뀌지 않는다(엣지 7, 게스트 뷰 전환용). */
const NO_RETRY_STATUSES = new Set([401]);

const buildUrl = (page: number, search?: string): string => {
  const params = new URLSearchParams({ page: String(page), limit: String(CHAIN_LIST_PAGE_SIZE) });
  if (search) params.set("search", search);
  return `${MINE_ENDPOINT}?${params.toString()}`;
};

type UseMyChainCardsOptions = {
  /** 호출측이 `isAuthenticated`를 전달한다 — 비로그인이면 쿼리 자체를 비활성화한다. */
  enabled: boolean;
  /** 체인 이름/포함 종목 부분 일치 검색어 — 공백뿐이면 무시. */
  search?: string;
};

/**
 * 내 밸류체인 목록 조회 훅 (UC-007 plan 모듈 D-3).
 * 401은 재시도하지 않고 즉시 오류로 전환한다(엣지 7 — 게스트 뷰 전환 판단은 Container 책임).
 */
export function useMyChainCards(
  options: UseMyChainCardsOptions,
): UseInfiniteQueryResult<InfiniteData<ChainCardListResponse>, ApiError> {
  const search = options.search?.trim() || undefined;
  return useInfiniteQuery({
    // 검색어별 캐시 분리 — 기존 [valuechains, mine] 프리픽스 무효화는 그대로 동작한다.
    queryKey: [...chainCardQueryKeys.mine, { search: search ?? null }],
    queryFn: async ({ pageParam }) => {
      const raw = await apiFetch<ChainCardListResponse>(buildUrl(pageParam, search));
      return ChainCardListResponseSchema.parse(raw);
    },
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: options.enabled,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
