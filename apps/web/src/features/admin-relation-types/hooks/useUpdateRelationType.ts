"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import { ADMIN_RELATION_TYPES_QUERY_KEY } from "@/features/admin-relation-types/hooks/useAdminRelationTypes";
import { RELATION_TYPES_EDITOR_QUERY_KEY } from "@/features/admin-relation-types/hooks/useCreateRelationType";
import type {
  RelationTypeMutationResponse,
  RelationTypeUpdateRequest,
} from "@/features/admin-relation-types/backend/schema";

export type UpdateRelationTypeVariables = { id: string; patch: RelationTypeUpdateRequest };

/**
 * 관계 종류 수정(이름 변경/비활성화/재활성화) 뮤테이션 훅(spec API-3). 성공 시 어드민 목록과
 * 편집 캔버스 선택 목록을 모두 invalidate한다(R-10, BR-8).
 */
export const useUpdateRelationType = (): UseMutationResult<
  RelationTypeMutationResponse,
  Error,
  UpdateRelationTypeVariables
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }) =>
      apiFetch<RelationTypeMutationResponse>(`/admin/relation-types/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_RELATION_TYPES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: RELATION_TYPES_EDITOR_QUERY_KEY });
    },
  });
};
