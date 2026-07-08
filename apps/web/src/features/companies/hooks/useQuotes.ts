"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { companyDetailQueryKeys } from "@/features/companies/hooks/company-detail-query-keys";
import type { QuotesResponse } from "@/features/companies/lib/dto";

const NO_RETRY_STATUSES = new Set([400, 404]);

/**
 * 주가(일봉)·시가총액 추이 조회 훅 (state_management.md §5). `keepPreviousData`로 기간 전환 시
 * 차트 깜빡임을 방지한다(E8: candles 미수집 시 섹션만 폴백 — Presenter 책임).
 */
export function useQuotes(
  securityId: string | undefined,
  range: { from: string; to: string },
): UseQueryResult<QuotesResponse, ApiError> {
  return useQuery({
    queryKey: securityId
      ? companyDetailQueryKeys.quotes(securityId, range)
      : ["securities", "quotes", "disabled"],
    queryFn: () =>
      apiFetch<QuotesResponse>(`/securities/${securityId}/quotes?from=${range.from}&to=${range.to}`),
    enabled: Boolean(securityId),
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
