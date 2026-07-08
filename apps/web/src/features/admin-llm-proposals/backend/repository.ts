import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLM_PROPOSAL_STATUSES } from "@iib/domain";
import type { ApproveRpcRow, ProposalListRpcRow } from "@/features/admin-llm-proposals/backend/schema";

const LLM_RELATION_PROPOSALS_TABLE = "llm_relation_proposals";

type ProposalStatusFilter = (typeof LLM_PROPOSAL_STATUSES)[number];

export type RepositoryReadResult<T> = { ok: true; rows: T } | { ok: false; message: string };
export type RepositorySingleResult<T> = { ok: true; row: T } | { ok: false; message: string };
export type RepositoryWriteResult = { ok: true } | { ok: false; message: string };

// ============================================
// listProposalRows
// ============================================

export type ListProposalRowsParams = {
  status: ProposalStatusFilter;
  limit: number;
  offset: number;
};

/**
 * `list_llm_proposals()` RPC 호출 캡슐화(R-5 — applicability 판정은 SQL 헬퍼 단일 SOT).
 * `limit = pageSize + 1`로 호출해 hasMore 판정 입력을 제공한다(총건수 COUNT 불필요).
 */
export const listProposalRows = async (
  client: SupabaseClient,
  params: ListProposalRowsParams,
): Promise<RepositoryReadResult<ProposalListRpcRow[]>> => {
  const { data, error } = await client.rpc("list_llm_proposals", {
    p_status: params.status,
    p_limit: params.limit,
    p_offset: params.offset,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, rows: (data ?? []) as ProposalListRpcRow[] };
};

// ============================================
// approveProposalRpc
// ============================================

export type ApproveProposalRpcParams = {
  proposalId: string;
  reviewerId: string;
};

/**
 * `approve_llm_proposal()` 원자 트랜잭션 RPC 호출 캡슐화(R-9 — outcome 코드 반환, 예외 없음).
 * RPC는 `SETOF` 반환이므로 배열의 첫 요소를 단일 행으로 취급한다.
 */
export const approveProposalRpc = async (
  client: SupabaseClient,
  params: ApproveProposalRpcParams,
): Promise<RepositorySingleResult<ApproveRpcRow>> => {
  const { data, error } = await client.rpc("approve_llm_proposal", {
    p_proposal_id: params.proposalId,
    p_reviewer_id: params.reviewerId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  const row = Array.isArray(data) ? (data[0] as ApproveRpcRow | undefined) : undefined;
  if (!row) {
    return { ok: false, message: "approve_llm_proposal RPC가 결과 행을 반환하지 않았습니다." };
  }
  return { ok: true, row };
};

// ============================================
// rejectProposalPending
// ============================================

export type RejectProposalPendingParams = {
  proposalId: string;
  reviewerId: string;
};

export type RejectedProposalRow = { id: string; reviewed_at: string };

/**
 * `status='pending'` 조건부 UPDATE(BR-5·BR-9 — 단순 갱신이라 RPC 불필요).
 * 0행이면 `updated: null`(throw 없음) — Service가 already_processed/not_found로 후속 분기.
 */
export const rejectProposalPending = async (
  client: SupabaseClient,
  params: RejectProposalPendingParams,
): Promise<{ ok: true; updated: RejectedProposalRow | null } | { ok: false; message: string }> => {
  const { data, error } = await client
    .from(LLM_RELATION_PROPOSALS_TABLE)
    .update({
      status: "rejected",
      reviewed_by: params.reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.proposalId)
    .eq("status", "pending")
    .select("id, reviewed_at");

  if (error) {
    return { ok: false, message: error.message };
  }

  const rows = (data ?? []) as RejectedProposalRow[];
  return { ok: true, updated: rows[0] ?? null };
};

// ============================================
// findProposalStatus
// ============================================

export type ProposalStatusRow = { id: string; status: string };

/** 거부 0행 시 404/409 분기용 — `id, status` 단건 조회. */
export const findProposalStatus = async (
  client: SupabaseClient,
  proposalId: string,
): Promise<RepositorySingleResult<ProposalStatusRow | null>> => {
  const { data, error } = await client
    .from(LLM_RELATION_PROPOSALS_TABLE)
    .select("id, status")
    .eq("id", proposalId)
    .maybeSingle<ProposalStatusRow>();

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, row: data ?? null };
};
