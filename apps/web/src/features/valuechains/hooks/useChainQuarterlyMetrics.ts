"use client";

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import type { IsoDate } from "@iib/domain";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainViewQueryKeys, type QuarterlyParams } from "@/features/valuechains/hooks/chain-view-query-keys";
import { DASHBOARD_METRICS_STALE_TIME_MS } from "@/features/valuechains/constants";
import type { QuarterlyMetricsResponse } from "@/features/valuechains/lib/dto";

const NO_RETRY_STATUSES = new Set([400, 401, 403, 404]);

/** 분기 지표(매출 합계) 조회 훅 — UC-010 plan 모듈 17, useChainDailyMetrics와 동형(분기 축). */
export const useChainQuarterlyMetrics = (
  chainId: string,
  params: QuarterlyParams & { at: IsoDate | null },
): UseQueryResult<QuarterlyMetricsResponse, ApiError> =>
  useQuery({
    queryKey: chainViewQueryKeys.quarterlyMetrics(chainId, params),
    queryFn: () => {
      const search = new URLSearchParams({
        fromYear: String(params.fromYear),
        fromQuarter: String(params.fromQuarter),
        toYear: String(params.toYear),
        toQuarter: String(params.toQuarter),
      });
      if (params.at) {
        search.set("at", params.at);
      }
      return apiFetch<QuarterlyMetricsResponse>(
        `/valuechains/${chainId}/metrics/quarterly?${search.toString()}`,
      );
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
