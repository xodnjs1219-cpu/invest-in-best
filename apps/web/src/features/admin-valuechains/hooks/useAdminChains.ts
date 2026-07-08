"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import type { AdminChainListResponse } from "@/features/admin-valuechains/backend/schema";

export const ADMIN_VALUECHAINS_QUERY_KEY = ["admin", "valuechains"] as const;

/**
 * 어드민 공식 체인 목록 조회 훅(UC-021 plan 모듈 M13).
 * 기본 보관 포함 조회(표시 분리는 Presenter 책임) — `GET /api/admin/valuechains`.
 */
export function useAdminChains(): UseQueryResult<AdminChainListResponse> {
  return useQuery({
    queryKey: ADMIN_VALUECHAINS_QUERY_KEY,
    queryFn: () => apiFetch<AdminChainListResponse>("/admin/valuechains?includeArchived=true"),
  });
}
