"use client";

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import type { IsoDate } from "@iib/domain";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainViewQueryKeys } from "@/features/valuechains/hooks/chain-view-query-keys";
import { DASHBOARD_METRICS_STALE_TIME_MS } from "@/features/valuechains/constants";
import type { DailyMetricsResponse } from "@/features/valuechains/lib/dto";

const NO_RETRY_STATUSES = new Set([400, 401, 403, 404]);

/**
 * 일별 지표(가치총액) 조회 훅 (UC-010 plan 모듈 16, state_management §6).
 * `keepPreviousData`로 기간·시점 전환 시 차트 깜빡임을 방지한다. 지표 패널은 독립 실패 처리(E13).
 */
export const useChainDailyMetrics = (
  chainId: string,
  params: { from: IsoDate; to: IsoDate; at: IsoDate | null },
): UseQueryResult<DailyMetricsResponse, ApiError> =>
  useQuery({
    queryKey: chainViewQueryKeys.dailyMetrics(chainId, params),
    queryFn: () => {
      const search = new URLSearchParams({ from: params.from, to: params.to });
      if (params.at) {
        search.set("at", params.at);
      }
      return apiFetch<DailyMetricsResponse>(`/valuechains/${chainId}/metrics/daily?${search.toString()}`);
    },
    placeholderData: keepPreviousData,
    staleTime: DASHBOARD_METRICS_STALE_TIME_MS,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });
