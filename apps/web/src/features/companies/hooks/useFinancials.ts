"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { companyDetailQueryKeys } from "@/features/companies/hooks/company-detail-query-keys";
import type { FinancialsResponse } from "@/features/companies/lib/dto";

const NO_RETRY_STATUSES = new Set([400, 404]);

/**
 * 분기 재무 조회 훅 (state_management.md §5). `enabled: !!securityId`로 summary 성공 후에만
 * 발화한다(의존 쿼리 체이닝). `keepPreviousData`로 기간 전환 시 표/그래프를 유지한다.
 */
export function useFinancials(
  securityId: string | undefined,
  range: { fromYear: number; toYear: number },
): UseQueryResult<FinancialsResponse, ApiError> {
  return useQuery({
    queryKey: securityId
      ? companyDetailQueryKeys.financials(securityId, range)
      : ["securities", "financials", "disabled"],
    queryFn: () =>
      apiFetch<FinancialsResponse>(
        `/securities/${securityId}/financials?fromYear=${range.fromYear}&toYear=${range.toYear}`,
      ),
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
