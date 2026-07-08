"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { SaveChainRequest, SaveChainResult } from "@iib/domain";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { chainCardQueryKeys } from "@/features/valuechains/hooks/chainCardQueryKeys";

export interface SaveChainMutationVariables {
  chainId: string | null;
  payload: SaveChainRequest;
  /** UC-021 official 분기 — 지정 시 body에 `chainType`을 합성한다(POST peek 디스패치용, R-2). */
  chainType?: "official";
  /** UC-021 official 분기 — 저장 확인 다이얼로그의 로컬 상태(편집 문서 상태 밖, R-8). */
  disclosureDate?: string | null;
}

/**
 * 저장 mutation 훅(UC-018 plan 모듈 17, UC-021이 official 분기로 확장).
 * `chainId===null`이면 신규 생성(POST), 존재하면 갱신(PUT).
 * `retry: 0`(비멱등 — 재시도 시 스냅샷/체인 중복 생성 위험. 재시도는 사용자 수동, E8).
 * 성공 시 내 목록(상한 게이트 D-2)과 체인 스코프 캐시를 invalidate한다.
 * `chainType`/`disclosureDate`가 지정되면 body에 합성한다(official 저장 — user 저장은 영향 없음).
 * 라우팅·reducer dispatch는 Provider `save()` 소관(이 훅은 서버 상태만 책임).
 */
export function useSaveChainMutation(): UseMutationResult<SaveChainResult, ApiError, SaveChainMutationVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chainId, payload, chainType, disclosureDate }) => {
      const body =
        chainType === "official"
          ? JSON.stringify({ ...payload, chainType, disclosureDate: disclosureDate ?? null })
          : JSON.stringify(payload);

      return chainId === null
        ? apiFetch<SaveChainResult>("/valuechains", { method: "POST", body })
        : apiFetch<SaveChainResult>(`/valuechains/${chainId}`, { method: "PUT", body });
    },
    retry: 0,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: chainCardQueryKeys.mine });
      queryClient.invalidateQueries({ queryKey: ["valuechains", data.chainId] });
    },
  });
}
