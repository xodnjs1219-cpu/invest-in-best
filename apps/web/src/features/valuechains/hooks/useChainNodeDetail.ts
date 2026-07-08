"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainViewQueryKeys } from "@/features/valuechains/hooks/chain-view-query-keys";
import { NODE_DETAIL_STALE_TIME_MS } from "@/features/valuechains/constants";
import type { NodeDetailResponse } from "@/features/valuechains/lib/dto";

/**
 * 노드 상세 조회 훅 (UC-011 plan 모듈 12, state_management §6).
 * 키에 nodeId가 포함되므로 빠른 연속 클릭 시 마지막 클릭 쿼리만 관찰된다(E10 — 취소 대신 키 교체).
 */
export const useChainNodeDetail = (
  chainId: string,
  nodeId: string | null,
): UseQueryResult<NodeDetailResponse, ApiError> =>
  useQuery({
    queryKey: chainViewQueryKeys.nodeDetail(chainId, nodeId ?? "__none__"),
    queryFn: () => apiFetch<NodeDetailResponse>(`/valuechains/${chainId}/nodes/${nodeId}`),
    enabled: nodeId !== null,
    staleTime: NODE_DETAIL_STALE_TIME_MS,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 500) {
        return failureCount < 1;
      }
      return false;
    },
  });
