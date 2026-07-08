"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { companyDetailQueryKeys } from "@/features/companies/hooks/company-detail-query-keys";
import type { CompanyValuechainsResponse } from "@/features/companies/lib/dto";

const NO_RETRY_STATUSES = new Set([404]);

/**
 * 소속 밸류체인 목록 조회 훅 (state_management.md §5) — 노출 범위는 서버(withOptionalAuth + RPC
 * 필터)가 판정하며 이 훅은 로직 없이 API를 그대로 호출한다. `enabled: !!securityId`.
 */
export function useBelongingChains(
  securityId: string | undefined,
): UseQueryResult<CompanyValuechainsResponse, ApiError> {
  return useQuery({
    queryKey: securityId
      ? companyDetailQueryKeys.valuechains(securityId)
      : ["securities", "valuechains", "disabled"],
    queryFn: () => apiFetch<CompanyValuechainsResponse>(`/securities/${securityId}/valuechains`),
    enabled: Boolean(securityId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
