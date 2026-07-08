"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { companyDetailQueryKeys } from "@/features/companies/hooks/company-detail-query-keys";
import type { CompanySummaryResponse } from "@/features/companies/lib/dto";

const NO_RETRY_STATUSES = new Set([400, 404, 409]);

/**
 * 기업 식별·요약 조회 훅 (state_management.md §5). 404/409는 재시도하지 않는다
 * (404=미존재 안내, 409=시장 선택 유도 — 재시도로 결과가 바뀌지 않음).
 */
export function useCompanySummary(
  ticker: string,
  market?: "KRX" | "US",
): UseQueryResult<CompanySummaryResponse, ApiError> {
  return useQuery({
    queryKey: companyDetailQueryKeys.summary(ticker, market ?? null),
    queryFn: () => {
      const search = new URLSearchParams();
      if (market) {
        search.set("market", market);
      }
      const qs = search.toString();
      return apiFetch<CompanySummaryResponse>(
        `/companies/${encodeURIComponent(ticker)}${qs ? `?${qs}` : ""}`,
      );
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
