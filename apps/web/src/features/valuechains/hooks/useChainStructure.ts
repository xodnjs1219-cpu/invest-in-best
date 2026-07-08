"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CHAIN_STRUCTURE_STALE_TIME_MS } from "@iib/domain";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainViewQueryKeys } from "@/features/valuechains/hooks/chain-view-query-keys";
import type { ChainViewResponse } from "@/features/valuechains/lib/dto";

/** 404류(400/401/403/404)는 재시도 금지 — 결과가 바뀌지 않는다(결정 C-2 방어적 통일). */
const NO_RETRY_STATUSES = new Set([400, 401, 403, 404]);

/**
 * 최신 구조(현재 구성) 조회 훅 (plan 모듈 C3, spec BR-6).
 * 404류는 재시도하지 않고, 그 외(500/네트워크)는 1회만 재시도한다.
 */
export const useChainStructure = (
  chainId: string,
  options: { enabled: boolean },
): UseQueryResult<ChainViewResponse, ApiError> =>
  useQuery({
    queryKey: chainViewQueryKeys.structure(chainId),
    queryFn: () => apiFetch<ChainViewResponse>(`/valuechains/${chainId}`),
    enabled: options.enabled,
    staleTime: CHAIN_STRUCTURE_STALE_TIME_MS,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });
