/**
 * 관계 종류 리포지토리 (docs/usecases/030/plan.md 모듈 11).
 * 활성 관계 종류(`is_active=true`) 목록 — LLM 입력·제안 매핑 검증(BR-4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface ActiveRelationTypeRow {
  relationTypeId: string;
  name: string;
  isDirected: boolean;
}

export async function listActiveRelationTypes(
  client: SupabaseClient,
): Promise<RepoResult<ActiveRelationTypeRow[]>> {
  const { data, error } = await client
    .from("relation_types")
    .select("id, name, is_directed")
    .eq("is_active", true);

  if (error || !data) {
    return repoFail(`listActiveRelationTypes failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(
    (data as Array<{ id: string; name: string; is_directed: boolean }>).map((row) => ({
      relationTypeId: row.id,
      name: row.name,
      isDirected: row.is_directed,
    })),
  );
}
