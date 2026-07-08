"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import type { BackfillProgressResponse } from "@/features/admin-batches/backend/schema";
import { resolveBackfillRefetchInterval } from "@/features/admin-batches/hooks/pollingPolicy";

export const BACKFILL_PROGRESS_QUERY_KEY = ["admin", "batches", "backfill-progress"] as const;

/** 백필 진행 현황 조회 훅(spec API-4). 최신 실행이 running이면 폴링 주기로 자동 재조회한다(R-6). */
export const useBackfillProgressQuery = (): UseQueryResult<BackfillProgressResponse> =>
  useQuery({
    queryKey: BACKFILL_PROGRESS_QUERY_KEY,
    queryFn: () => apiFetch<BackfillProgressResponse>("/admin/batches/backfill/progress"),
    refetchInterval: (query) => resolveBackfillRefetchInterval(query.state.data),
  });
