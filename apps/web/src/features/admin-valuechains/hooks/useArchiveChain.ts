"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import { chainCardQueryKeys } from "@/features/valuechains/hooks/chainCardQueryKeys";
import { ADMIN_VALUECHAINS_QUERY_KEY } from "@/features/admin-valuechains/hooks/useAdminChains";
import type { ArchiveChainResponse } from "@/features/admin-valuechains/backend/schema";

export type ArchiveChainVariables = { chainId: string };

/**
 * 공식 체인 보관 뮤테이션 훅(UC-021 plan 모듈 M14). `DELETE /api/admin/valuechains/:chainId`
 * (200 JSON 응답 — `apiFetch` 사용, 공용 `apiDelete`는 void 반환이라 부적합).
 * 성공 시 어드민 목록·공개 목록(official)·해당 체인 스코프 캐시를 모두 정리한다.
 */
export function useArchiveChain(): UseMutationResult<ArchiveChainResponse, Error, ArchiveChainVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chainId }) =>
      apiFetch<ArchiveChainResponse>(`/admin/valuechains/${chainId}`, { method: "DELETE" }),
    retry: 0,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_VALUECHAINS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: chainCardQueryKeys.official });
      queryClient.removeQueries({ queryKey: ["valuechains", variables.chainId] });
    },
  });
}
