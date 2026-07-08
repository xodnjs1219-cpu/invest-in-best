"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { BatchJobType, BatchRunStatus } from "@iib/domain";
import { apiFetch } from "@/lib/http/api-client";
import type { BatchRunsListResponse } from "@/features/admin-batches/backend/schema";
import { resolveRunsRefetchInterval } from "@/features/admin-batches/hooks/pollingPolicy";

export type BatchRunsFilters = {
  jobType: BatchJobType | null;
  status: BatchRunStatus | null;
  from: string | null;
  to: string | null;
};

/** 쿼리 키 prefix — `invalidateQueries({ queryKey: BATCH_RUNS_QUERY_KEY_PREFIX })`로 전체 무효화한다. */
export const BATCH_RUNS_QUERY_KEY_PREFIX = ["admin", "batches", "runs"] as const;

export const batchRunsQueryKey = (filters: BatchRunsFilters, page: number) =>
  [...BATCH_RUNS_QUERY_KEY_PREFIX, { ...filters, page }] as const;

const buildQueryString = (filters: BatchRunsFilters, page: number): string => {
  const params = new URLSearchParams();
  if (filters.jobType) params.set("jobType", filters.jobType);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(page));
  return params.toString();
};

/**
 * 배치 실행 이력 목록 조회 훅(spec API-1). running 실행 존재 시 폴링 주기로 자동 재조회하고
 * (R-6), 페이지/필터 전환 시 `keepPreviousData`로 깜빡임을 방지한다.
 */
export const useBatchRunsQuery = (
  filters: BatchRunsFilters,
  page: number,
): UseQueryResult<BatchRunsListResponse> =>
  useQuery({
    queryKey: batchRunsQueryKey(filters, page),
    queryFn: () => apiFetch<BatchRunsListResponse>(`/admin/batches/runs?${buildQueryString(filters, page)}`),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => resolveRunsRefetchInterval(query.state.data),
  });
