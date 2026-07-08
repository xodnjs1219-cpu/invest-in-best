"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import type { BatchRunFailuresResponse } from "@/features/admin-batches/backend/schema";

export const batchRunFailuresQueryKey = (runId: string, page: number) =>
  ["admin", "batches", "run", runId, "failures", page] as const;

/** 실행별 종목 단위 실패 목록 조회 훅(spec API-3). `runId`가 없으면 비활성화한다. */
export const useBatchRunFailuresQuery = (
  runId: string | null,
  page: number,
): UseQueryResult<BatchRunFailuresResponse> =>
  useQuery({
    queryKey: batchRunFailuresQueryKey(runId ?? "", page),
    queryFn: () => apiFetch<BatchRunFailuresResponse>(`/admin/batches/runs/${runId}/failures?page=${page}`),
    enabled: runId !== null,
    placeholderData: keepPreviousData,
  });
