/**
 * 체크포인트 리포지토리 (docs/usecases/027/plan.md 모듈 5, UC-031 백필과 공유).
 * batch_checkpoints SELECT/UPSERT 캡슐화 — 이월 커서(E1)·SEC Last-Modified 저장.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface Checkpoint {
  cursor: unknown;
  isCompleted: boolean;
}

export async function getCheckpoint(
  client: SupabaseClient,
  jobType: string,
  checkpointKey: string,
): Promise<RepoResult<Checkpoint | null>> {
  const { data, error } = await client
    .from("batch_checkpoints")
    .select("cursor, is_completed")
    .eq("job_type", jobType)
    .eq("checkpoint_key", checkpointKey)
    .maybeSingle<{ cursor: unknown; is_completed: boolean }>();

  if (error) {
    return repoFail(`getCheckpoint failed: ${error.message}`);
  }
  if (!data) {
    return repoOk(null);
  }
  return repoOk({ cursor: data.cursor, isCompleted: data.is_completed });
}

export async function upsertCheckpoint(
  client: SupabaseClient,
  jobType: string,
  checkpointKey: string,
  cursor: unknown,
  isCompleted: boolean,
): Promise<RepoResult<void>> {
  const { error } = await client.from("batch_checkpoints").upsert(
    {
      job_type: jobType,
      checkpoint_key: checkpointKey,
      cursor,
      is_completed: isCompleted,
    },
    { onConflict: "job_type,checkpoint_key" },
  );

  if (error) {
    return repoFail(`upsertCheckpoint failed: ${error.message}`);
  }
  return repoOk(undefined);
}

export async function completeCheckpoint(
  client: SupabaseClient,
  jobType: string,
  checkpointKey: string,
): Promise<RepoResult<void>> {
  const { error } = await client
    .from("batch_checkpoints")
    .update({ is_completed: true })
    .eq("job_type", jobType)
    .eq("checkpoint_key", checkpointKey);

  if (error) {
    return repoFail(`completeCheckpoint failed: ${error.message}`);
  }
  return repoOk(undefined);
}

export interface IncompleteCheckpoint {
  checkpointKey: string;
  cursor: unknown;
}

/**
 * UC-031 백필 재개 지점 조회(docs/usecases/031/plan.md 모듈 12) — job_type의 미완료
 * (is_completed=false) 체크포인트 전체를 key/cursor 쌍으로 반환한다(idx_batch_checkpoints_incomplete 활용).
 */
export async function findIncompleteCheckpoints(
  client: SupabaseClient,
  jobType: string,
): Promise<RepoResult<IncompleteCheckpoint[]>> {
  const { data, error } = await client
    .from("batch_checkpoints")
    .select("checkpoint_key, cursor")
    .eq("job_type", jobType)
    .eq("is_completed", false);

  if (error || !data) {
    return repoFail(`findIncompleteCheckpoints failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(
    (data as Array<{ checkpoint_key: string; cursor: unknown }>).map((row) => ({
      checkpointKey: row.checkpoint_key,
      cursor: row.cursor,
    })),
  );
}

/** UC-031 H-8(재백필 전체 리셋) 전용 — job_type 조건 밖의 다른 잡 체크포인트는 절대 건드리지 않는다. */
export async function deleteAllCheckpoints(client: SupabaseClient, jobType: string): Promise<RepoResult<void>> {
  const { error } = await client.from("batch_checkpoints").delete().eq("job_type", jobType);

  if (error) {
    return repoFail(`deleteAllCheckpoints failed: ${error.message}`);
  }
  return repoOk(undefined);
}
