"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import { ADMIN_RELATION_TYPES_QUERY_KEY } from "@/features/admin-relation-types/hooks/useAdminRelationTypes";
import type {
  RelationTypeCreateRequest,
  RelationTypeMutationResponse,
} from "@/features/admin-relation-types/backend/schema";

/** UC-016 편집 캔버스가 소비하는 활성 종류 목록 쿼리 키(R-10 — 본 plan은 invalidate만 수행). */
export const RELATION_TYPES_EDITOR_QUERY_KEY = ["relation-types"] as const;

/**
 * 관계 종류 추가 뮤테이션 훅(spec API-2). 성공 시 어드민 목록과 편집 캔버스 선택 목록을
 * 모두 invalidate한다(R-10, BR-8 — 동일 세션 즉시 반영).
 */
export const useCreateRelationType = (): UseMutationResult<
  RelationTypeMutationResponse,
  Error,
  RelationTypeCreateRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) =>
      apiFetch<RelationTypeMutationResponse>("/admin/relation-types", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_RELATION_TYPES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: RELATION_TYPES_EDITOR_QUERY_KEY });
    },
  });
};
