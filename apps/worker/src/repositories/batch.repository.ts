/**
 * 배치 리포지토리 (docs/usecases/026/plan.md 모듈 7).
 * batch_runs INSERT/UPDATE, batch_item_failures SELECT/INSERT/UPDATE 캡슐화.
 * 모든 함수는 SupabaseClient 인자 + discriminated union 결과 반환(throw 금지, techstack §4 컨벤션).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface InsertRunInput {
  jobType: string;
  targetMarket?: string;
}

export interface InsertRunResult {
  runId: string;
}

export async function insertRun(
  client: SupabaseClient,
  input: InsertRunInput,
): Promise<RepoResult<InsertRunResult>> {
  const { data, error } = await client
    .from("batch_runs")
    .insert({
      job_type: input.jobType,
      status: "running",
      target_market: input.targetMarket ?? null,
    })
    .select()
    .single<{ id: string }>();

  if (error || !data) {
    return repoFail(`insertRun failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk({ runId: data.id });
}

export interface FinishRunInput {
  status: "success" | "partial_success" | "failed";
  processedCount: number;
  failedCount: number;
  isCarriedOver: boolean;
  errorLog: string | null;
}

export async function finishRun(
  client: SupabaseClient,
  runId: string,
  input: FinishRunInput,
): Promise<RepoResult<void>> {
  const { error } = await client
    .from("batch_runs")
    .update({
      status: input.status,
      processed_count: input.processedCount,
      failed_count: input.failedCount,
      is_carried_over: input.isCarriedOver,
      error_log: input.errorLog,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    return repoFail(`finishRun failed: ${error.message}`);
  }
  return repoOk(undefined);
}

export interface RunningRun {
  id: string;
  startedAt: string;
}

/** 동일 잡의 running 실행 최신 1건(E16 2차 방어 — DB 레벨 중복 실행 검사). */
export async function findRunningRun(
  client: SupabaseClient,
  jobType: string,
): Promise<RepoResult<RunningRun | null>> {
  const { data, error } = await client
    .from("batch_runs")
    .select("id, started_at")
    .eq("job_type", jobType)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    return repoFail(`findRunningRun failed: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{ id: string; started_at: string }>;
  if (rows.length === 0) {
    return repoOk(null);
  }
  return repoOk({ id: rows[0]!.id, startedAt: rows[0]!.started_at });
}

export interface LatestRunByStatus {
  id: string;
  startedAt: string;
}

/**
 * 해당 잡·상태의 최신 실행 1건 (docs/usecases/029/plan.md 모듈 7 확장).
 * 직전 성공 실행 조회(대상 범위·정정 감지 기준 시각) — `idx(job_type, started_at DESC)` 활용.
 */
export async function findLatestRunByStatus(
  client: SupabaseClient,
  jobType: string,
  status: "running" | "success" | "partial_success" | "failed",
): Promise<RepoResult<LatestRunByStatus | null>> {
  const { data, error } = await client
    .from("batch_runs")
    .select("id, started_at")
    .eq("job_type", jobType)
    .eq("status", status)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    return repoFail(`findLatestRunByStatus failed: ${error.message}`);
  }
  const [row] = (data ?? []) as Array<{ id: string; started_at: string }>;
  if (row === undefined) {
    return repoOk(null);
  }
  return repoOk({ id: row.id, startedAt: row.started_at });
}

export interface UnresolvedFailure {
  id: string;
  securityId: string | null;
}

export async function findUnresolvedFailures(
  client: SupabaseClient,
  jobType: string,
): Promise<RepoResult<UnresolvedFailure[]>> {
  const { data, error } = await client
    .from("batch_item_failures")
    .select("id, security_id, batch_runs!inner(job_type)")
    .eq("batch_runs.job_type", jobType)
    .eq("is_resolved", false);

  if (error || !data) {
    return repoFail(`findUnresolvedFailures failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(
    (data as unknown as Array<{ id: string; security_id: string | null }>).map((row) => ({
      id: row.id,
      securityId: row.security_id,
    })),
  );
}

export interface ItemFailureInput {
  securityId: string;
  attemptCount: number;
  lastError: string;
}

export async function insertItemFailures(
  client: SupabaseClient,
  runId: string,
  failures: ItemFailureInput[],
): Promise<RepoResult<void>> {
  if (failures.length === 0) return repoOk(undefined);

  const rows = failures.map((failure) => ({
    batch_run_id: runId,
    security_id: failure.securityId,
    attempt_count: failure.attemptCount,
    last_error: failure.lastError,
  }));

  const { error } = await client.from("batch_item_failures").insert(rows);
  if (error) {
    return repoFail(`insertItemFailures failed: ${error.message}`);
  }
  return repoOk(undefined);
}

export async function resolveFailures(
  client: SupabaseClient,
  failureIds: string[],
): Promise<RepoResult<void>> {
  if (failureIds.length === 0) return repoOk(undefined);

  const { error } = await client
    .from("batch_item_failures")
    .update({ is_resolved: true })
    .in("id", failureIds);

  if (error) {
    return repoFail(`resolveFailures failed: ${error.message}`);
  }
  return repoOk(undefined);
}
