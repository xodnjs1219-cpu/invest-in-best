"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { RelationType } from "@iib/domain";
import { apiFetch } from "@/lib/http/api-client";

const RELATION_TYPES_ENDPOINT = "/relation-types";

export const chainEditorQueryKeys = {
  relationTypes: ["relation-types"] as const,
};

type RelationTypeListResponse = { relationTypes: RelationType[] };

/**
 * 관계 종류 목록 조회 훅(UC-016 API-1, plan 모듈 M15).
 * 전체 조회(active 미지정)로 호출한다 — 비활성 종류의 기존 엣지 라벨 렌더링을 위해(BR-6).
 * 활성 필터링은 computed(Context의 `activeRelationTypes`)에서 파생한다.
 */
export function useRelationTypes(): UseQueryResult<RelationType[]> {
  return useQuery({
    queryKey: chainEditorQueryKeys.relationTypes,
    queryFn: async () => {
      const response = await apiFetch<RelationTypeListResponse>(RELATION_TYPES_ENDPOINT);
      return response.relationTypes;
    },
  });
}
