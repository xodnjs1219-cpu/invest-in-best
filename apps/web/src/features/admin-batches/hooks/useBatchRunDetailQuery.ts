"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import type { BatchRunDetailResponse } from "@/features/admin-batches/backend/schema";

export const batchRunDetailQueryKey = (runId: string) => ["admin", "batches", "run", runId] as const;

/** 배치 실행 상세 조회 훅(spec API-2). `runId`가 없으면 비활성화한다. */
export const useBatchRunDetailQuery = (runId: string | null): UseQueryResult<BatchRunDetailResponse> =>
  useQuery({
    queryKey: batchRunDetailQueryKey(runId ?? ""),
    queryFn: () => apiFetch<BatchRunDetailResponse>(`/admin/batches/runs/${runId}`),
    enabled: runId !== null,
  });
