"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { apiDelete, type ApiError } from "@/lib/http/api-client";
import { chainCardQueryKeys } from "@/features/valuechains/hooks/chainCardQueryKeys";

export type DeleteChainVariables = { chainId: string };

/**
 * 사용자 체인 삭제 mutation 훅 (UC-019 plan 모듈 6).
 * `DELETE /valuechains/{chainId}`(204 무본문) 호출 + 성공 시 내 체인 목록 캐시 무효화·
 * 삭제된 체인의 체인 스코프 캐시(`['valuechains', chainId, ...]`) 제거를 담당한다
 * (단일 책임 — 다이얼로그 상태·라우팅·문구 매핑은 `useDeleteChainAction`이 담당).
 * 재시도 없음(`retry: 0`) — 멱등이지만 실패는 사용자 수동 재시도로 처리한다.
 */
export const useDeleteChain = (): UseMutationResult<void, ApiError, DeleteChainVariables> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chainId }) => apiDelete(`/valuechains/${chainId}`),
    onSuccess: (_data, { chainId }) => {
      void queryClient.invalidateQueries({ queryKey: chainCardQueryKeys.mine });
      void queryClient.removeQueries({ queryKey: ["valuechains", chainId] });
    },
    retry: 0,
  });
};
