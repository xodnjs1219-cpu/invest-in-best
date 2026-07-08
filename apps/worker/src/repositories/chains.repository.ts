/**
 * 체인 리포지토리 (docs/usecases/029/plan.md 모듈 6).
 * `value_chains` 집계 대상(`is_archived=false`) SELECT — 공식+사용자 전체(BR 6.3, E14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface ActiveChain {
  id: string;
}

export async function findActiveChains(client: SupabaseClient): Promise<RepoResult<ActiveChain[]>> {
  const { data, error } = await client.from("value_chains").select("id").eq("is_archived", false);

  if (error || !data) {
    return repoFail(`findActiveChains failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk((data as Array<{ id: string }>).map((row) => ({ id: row.id })));
}
