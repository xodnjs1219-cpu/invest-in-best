"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import type { AdminRelationTypeListResponse } from "@/features/admin-relation-types/backend/schema";

/** 쿼리 키 — M10 뮤테이션 성공 시 이 키를 invalidate한다(R-10). */
export const ADMIN_RELATION_TYPES_QUERY_KEY = ["admin", "relation-types"] as const;

/**
 * 관계 종류 마스터 전체 목록 조회 훅(spec API-1). 마스터 소규모 목록이라 페이지네이션 없음.
 * 401/403 ApiError는 전파한다(레이아웃 가드가 선차단하므로 세션 만료 케이스 — 오류 화면에서 재로그인 유도).
 */
export const useAdminRelationTypes = (): UseQueryResult<AdminRelationTypeListResponse> =>
  useQuery({
    queryKey: ADMIN_RELATION_TYPES_QUERY_KEY,
    queryFn: () => apiFetch<AdminRelationTypeListResponse>("/admin/relation-types"),
  });
