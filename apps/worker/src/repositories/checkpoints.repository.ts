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
