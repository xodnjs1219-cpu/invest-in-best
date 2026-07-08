"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import type { LatestSnapshotResponse } from "@/features/valuechains/lib/dto";

/**
 * 편집 대상 체인 최신 구성 조회 훅(UC-016 API-2, plan 모듈 M16).
 * `chainId`가 있을 때만 활성화(edit 모드 전용) — create 모드는 이 훅을 호출하지 않는다.
 * 부트스트랩 변환(`toEditorBootstrap`)은 Provider 이펙트 책임(UC-013/018 plan 소관).
 */
export function useLatestSnapshot(chainId: string | null): UseQueryResult<LatestSnapshotResponse> {
  return useQuery({
    queryKey: ["valuechains", chainId, "latest-snapshot"] as const,
    queryFn: () => apiFetch<LatestSnapshotResponse>(`/valuechains/${chainId}/snapshots/latest`),
    enabled: chainId !== null,
  });
}
