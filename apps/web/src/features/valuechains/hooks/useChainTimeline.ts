"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainViewQueryKeys } from "@/features/valuechains/hooks/chain-view-query-keys";
import { TIMELINE_META_STALE_TIME_MS } from "@/features/valuechains/constants";
import type { TimelineMetaResponse } from "@/features/valuechains/lib/dto";

const NO_RETRY_STATUSES = new Set([400, 401, 403, 404]);

/** 타임라인 메타(선택 가능 범위 + 스냅샷 마커) 조회 훅 — UC-012 plan 모듈 13. */
export const useChainTimeline = (chainId: string): UseQueryResult<TimelineMetaResponse, ApiError> =>
  useQuery({
    queryKey: chainViewQueryKeys.timeline(chainId),
    queryFn: () => apiFetch<TimelineMetaResponse>(`/valuechains/${chainId}/timeline`),
    staleTime: TIMELINE_META_STALE_TIME_MS,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });
