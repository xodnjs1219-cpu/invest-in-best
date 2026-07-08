"use client";

import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { companyDetailQueryKeys } from "@/features/companies/hooks/company-detail-query-keys";
import type { DisclosuresResponse } from "@/features/companies/lib/dto";

const INITIAL_PAGE_PARAM = 1;
const NO_RETRY_STATUSES = new Set([400, 404]);

/**
 * 주요 공시 목록 조회 훅 (state_management.md §5) — 더보기는 `fetchNextPage()`로 처리(Action 아님).
 * `enabled: !!securityId`로 summary 성공 후에만 발화한다.
 */
export function useDisclosures(
  securityId: string | undefined,
): UseInfiniteQueryResult<InfiniteData<DisclosuresResponse>, ApiError> {
  return useInfiniteQuery({
    queryKey: securityId
      ? companyDetailQueryKeys.disclosures(securityId)
      : ["securities", "disclosures", "disabled"],
    queryFn: ({ pageParam }) =>
      apiFetch<DisclosuresResponse>(`/securities/${securityId}/disclosures?page=${pageParam}`),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: Boolean(securityId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
