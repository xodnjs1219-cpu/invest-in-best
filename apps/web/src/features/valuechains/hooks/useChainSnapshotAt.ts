"use client";

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import type { IsoDate } from "@iib/domain";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainViewQueryKeys } from "@/features/valuechains/hooks/chain-view-query-keys";
import { SNAPSHOT_AT_STALE_TIME_MS } from "@/features/valuechains/constants";
import type { SnapshotAtResponse } from "@/features/valuechains/lib/dto";

const NO_RETRY_STATUSES = new Set([400, 401, 403, 404]);

/**
 * 시점 복원(스냅샷) 조회 훅 — UC-012 plan 모듈 13.
 * `placeholderData: keepPreviousData`로 시점 전환 로딩 중 직전 구조를 유지한다(빈 화면 금지).
 * `SNAPSHOT_NOT_FOUND`(404)는 재시도하지 않는다.
 */
export const useChainSnapshotAt = (
  chainId: string,
  date: IsoDate | null,
): UseQueryResult<SnapshotAtResponse, ApiError> =>
  useQuery({
    queryKey: chainViewQueryKeys.snapshotAt(chainId, date ?? ("__none__" as IsoDate)),
    queryFn: () => apiFetch<SnapshotAtResponse>(`/valuechains/${chainId}/snapshot-at?date=${date}`),
    enabled: date !== null,
    placeholderData: keepPreviousData,
    staleTime: SNAPSHOT_AT_STALE_TIME_MS,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });
