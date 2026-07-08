"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "@/lib/http/api-client";
import { chainCardQueryKeys } from "@/features/valuechains/hooks/chainCardQueryKeys";
import type { CloneChainResponse } from "@/features/valuechains/lib/dto";

export type CloneChainVariables = { chainId: string };

/**
 * 공식 체인 복제 mutation 훅 (UC-014 plan 모듈 11).
 * `POST /valuechains/{chainId}/clone`(Body 없음) 호출 + 성공 시 내 체인 목록 캐시 무효화만 담당한다
 * (단일 책임 — 라우팅·토스트·로그인 확인은 `useCloneChainAction`이 담당).
 */
export const useCloneChain = (): UseMutationResult<
  CloneChainResponse,
  ApiError,
  CloneChainVariables
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chainId }) =>
      apiFetch<CloneChainResponse>(`/valuechains/${chainId}/clone`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chainCardQueryKeys.mine });
    },
    retry: 0,
  });
};
