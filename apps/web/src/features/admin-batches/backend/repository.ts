import type { SupabaseClient } from "@supabase/supabase-js";
import type { BatchJobType, BatchRunStatus } from "@iib/domain";
import type {
  BackfillLatestRunRow,
  BatchItemFailureRow,
  BatchRunDetailRow,
  BatchRunSummaryRow,
} from "@/features/admin-batches/backend/schema";

const BATCH_RUNS_SUMMARY_VIEW = "batch_runs_summary";
const BATCH_RUNS_TABLE = "batch_runs";
const BATCH_ITEM_FAILURES_TABLE = "batch_item_failures";
const BATCH_CHECKPOINTS_TABLE = "batch_checkpoints";
const BACKFILL_JOB_TYPE: BatchJobType = "backfill_all";

export type RepositoryReadResult<T> = { ok: true; rows: T; totalCount: number } | { ok: false; message: string };
export type RepositorySingleResult<T> = { ok: true; row: T | null } | { ok: false; message: string };

// ============================================
// listRunSummaries
// ============================================

export type ListRunSummariesParams = {
  jobType?: BatchJobType;
  status?: BatchRunStatus;
  fromIso?: string;
  toIso?: string;
  limit: number;
  offset: number;
};

/**
 * 목록 요약 뷰(`batch_runs_summary`, M3)에서 필터·정렬·페이지네이션 조회(R-2·R-3).
 * `error_log` 본문은 뷰에 존재하지 않아 구조적으로 목록 응답에 노출될 수 없다(BR-6).
 */
export const listRunSummaries = async (
  client: SupabaseClient,
  params: ListRunSummariesParams,
): Promise<RepositoryReadResult<BatchRunSummaryRow[]>> => {
  let query = client.from(BATCH_RUNS_SUMMARY_VIEW).select("*", { count: "exact" });

  if (params.jobType) {
    query = query.eq("job_type", params.jobType);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.fromIso) {
    query = query.gte("started_at", params.fromIso);
  }
  if (params.toIso) {
    query = query.lte("started_at", params.toIso);
  }

  const { data, error, count } = await query
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, rows: (data ?? []) as BatchRunSummaryRow[], totalCount: count ?? 0 };
};

// ============================================
// findRunById
// ============================================

/** `batch_runs` 단건 조회(`error_log` 포함) — 상세 조회(API-2) 전용(BR-6). */
export const findRunById = async (
  client: SupabaseClient,
  runId: string,
): Promise<RepositorySingleResult<BatchRunDetailRow>> => {
  const { data, error } = await client
    .from(BATCH_RUNS_TABLE)
    .select(
      "id, job_type, status, started_at, finished_at, processed_count, failed_count, is_carried_over, target_market, error_log",
    )
    .eq("id", runId)
    .maybeSingle<BatchRunDetailRow>();

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, row: data ?? null };
};

// ============================================
// listFailuresByRun
// ============================================

export type ListFailuresByRunParams = {
  limit: number;
  offset: number;
};

/** 실행별 종목 단위 실패 목록 + securities 임베드(API-3, R-9 — `idx_batch_item_failures_run` 활용). */
export const listFailuresByRun = async (
  client: SupabaseClient,
  runId: string,
  params: ListFailuresByRunParams,
): Promise<RepositoryReadResult<BatchItemFailureRow[]>> => {
  const { data, error, count } = await client
    .from(BATCH_ITEM_FAILURES_TABLE)
    .select("id, attempt_count, last_error, is_resolved, updated_at, securities(id, ticker, name, market)", {
      count: "exact",
    })
    .eq("batch_run_id", runId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, rows: (data ?? []) as unknown as BatchItemFailureRow[], totalCount: count ?? 0 };
};

// ============================================
// countBackfillCheckpoints
// ============================================

export type BackfillCheckpointCounts = { total: number; completed: number };

/** 백필 체크포인트 완료/전체 건수를 head count 2회로 산출(R-5). */
export const countBackfillCheckpoints = async (
  client: SupabaseClient,
): Promise<{ ok: true; total: number; completed: number } | { ok: false; message: string }> => {
  const totalResult = await client
    .from(BATCH_CHECKPOINTS_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("job_type", BACKFILL_JOB_TYPE);

  if (totalResult.error) {
    return { ok: false, message: totalResult.error.message };
  }

  const completedResult = await client
    .from(BATCH_CHECKPOINTS_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("job_type", BACKFILL_JOB_TYPE)
    .eq("is_completed", true);

  if (completedResult.error) {
    return { ok: false, message: completedResult.error.message };
  }

  return { ok: true, total: totalResult.count ?? 0, completed: completedResult.count ?? 0 };
};

// ============================================
// findLatestBackfillRun
// ============================================

/** `job_type=backfill_all` 최신 실행 1건(API-4) — 이력 없으면 `null`(E11). */
export const findLatestBackfillRun = async (
  client: SupabaseClient,
): Promise<RepositorySingleResult<BackfillLatestRunRow>> => {
  const { data, error } = await client
    .from(BATCH_RUNS_TABLE)
    .select("id, status, started_at, finished_at")
    .eq("job_type", BACKFILL_JOB_TYPE)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<BackfillLatestRunRow>();

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, row: data ?? null };
};
