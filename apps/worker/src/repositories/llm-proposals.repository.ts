/**
 * 제안 리포지토리 (docs/usecases/030/plan.md 모듈 13).
 * llm_relation_proposals 기존 pending 키 조회 + 행 단위 INSERT(23505 스킵 — R-5).
 * UPDATE/DELETE 함수는 정의하지 않는다(BR-6 — 기존 제안 수정·삭제는 UC-022 소관).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LlmProposalType } from "@iib/domain";
import { repoFail, repoOk, type RepoResult } from "./result";

/** 부분 유니크(uq_llm_proposals_pending) 충돌 오류 코드. */
const POSTGRES_UNIQUE_VIOLATION = "23505";

export interface PendingProposalKey {
  chainId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationTypeId: string | null;
  proposalType: LlmProposalType;
}

interface PendingProposalKeyRow {
  chain_id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type_id: string | null;
  proposal_type: LlmProposalType;
}

/** 기존 pending 제안 키 목록(회차 내 dedupe·무향 역방향 대조의 입력, R-5). */
export async function listPendingKeys(
  client: SupabaseClient,
  chainIds: string[],
): Promise<RepoResult<PendingProposalKey[]>> {
  if (chainIds.length === 0) return repoOk([]);

  const { data, error } = await client
    .from("llm_relation_proposals")
    .select("chain_id, source_node_id, target_node_id, relation_type_id, proposal_type")
    .eq("status", "pending")
    .in("chain_id", chainIds);

  if (error || !data) {
    return repoFail(`listPendingKeys failed: ${error?.message ?? "no data returned"}`);
  }

  return repoOk(
    (data as PendingProposalKeyRow[]).map((row) => ({
      chainId: row.chain_id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      relationTypeId: row.relation_type_id,
      proposalType: row.proposal_type,
    })),
  );
}

export interface InsertPendingProposalInput {
  chainId: string;
  basedOnSnapshotId: string;
  proposalType: LlmProposalType;
  sourceNodeId: string;
  targetNodeId: string;
  relationTypeId: string; // F-1 — non-null만 수용
  disclosureId: string;
  rationale: string;
}

export type InsertPendingProposalResult =
  | { ok: true; inserted: boolean }
  | { ok: false; error: string };

/**
 * pending 제안 단건 INSERT. 부분 유니크 충돌(23505)은 오류가 아닌 스킵(병합)으로 처리한다(E5·BR-7).
 * 회차당 제안 건수가 소량이라 행 단위 INSERT로 충분(성능 이슈 시 리포지토리 뒤에서 RPC로 교체 가능).
 */
export async function insertPendingProposal(
  client: SupabaseClient,
  row: InsertPendingProposalInput,
): Promise<InsertPendingProposalResult> {
  const { error } = await client.from("llm_relation_proposals").insert({
    chain_id: row.chainId,
    based_on_snapshot_id: row.basedOnSnapshotId,
    proposal_type: row.proposalType,
    source_node_id: row.sourceNodeId,
    target_node_id: row.targetNodeId,
    relation_type_id: row.relationTypeId,
    disclosure_id: row.disclosureId,
    rationale: row.rationale,
    status: "pending",
  });

  if (error) {
    if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
      return { ok: true, inserted: false };
    }
    return { ok: false, error: `insertPendingProposal failed: ${error.message}` };
  }
  return { ok: true, inserted: true };
}
