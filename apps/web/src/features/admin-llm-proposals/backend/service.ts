import { ADMIN_LLM_PROPOSALS_PAGE_SIZE } from "@iib/domain";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import { adminLlmProposalErrorCodes, type AdminLlmProposalServiceError } from "@/features/admin-llm-proposals/backend/error";
import type {
  ApproveProposalRpcParams,
  ListProposalRowsParams,
  ProposalStatusRow,
  RejectedProposalRow,
  RejectProposalPendingParams,
  RepositoryReadResult,
  RepositorySingleResult,
} from "@/features/admin-llm-proposals/backend/repository";
import {
  ProposalListRpcRowSchema,
  type ApproveRpcRow,
  type ProposalApproveResponse,
  type ProposalListItem,
  type ProposalListQuery,
  type ProposalListResponse,
  type ProposalListRpcRow,
  type ProposalRejectResponse,
} from "@/features/admin-llm-proposals/backend/schema";

/**
 * service가 의존하는 repository 함수 시그니처 — 테스트에서 mock 주입이 가능하도록
 * 인터페이스 타입으로 분리한다(service.ts는 Supabase 쿼리 문법을 알지 못한다).
 */
export type AdminLlmProposalRepositoryDeps = {
  listProposalRows: (params: ListProposalRowsParams) => Promise<RepositoryReadResult<ProposalListRpcRow[]>>;
  approveProposalRpc: (params: ApproveProposalRpcParams) => Promise<RepositorySingleResult<ApproveRpcRow>>;
  rejectProposalPending: (
    params: RejectProposalPendingParams,
  ) => Promise<{ ok: true; updated: RejectedProposalRow | null } | { ok: false; message: string }>;
  findProposalStatus: (proposalId: string) => Promise<RepositorySingleResult<ProposalStatusRow | null>>;
};

const toNodeSummary = (
  nodeId: string,
  displayName: string,
  nodeKind: ProposalListRpcRow["source_node_kind"],
  ticker: string | null,
) => ({ nodeId, displayName, nodeKind, ticker });

const toListItem = (row: ProposalListRpcRow): ProposalListItem => ({
  proposalId: row.proposal_id,
  chain: { chainId: row.chain_id, name: row.chain_name },
  proposalType: row.proposal_type,
  sourceNode: toNodeSummary(row.source_node_id, row.source_display_name, row.source_node_kind, row.source_ticker),
  targetNode: toNodeSummary(row.target_node_id, row.target_display_name, row.target_node_kind, row.target_ticker),
  relationType: row.relation_type_id
    ? {
        relationTypeId: row.relation_type_id,
        name: row.relation_type_name ?? "",
        isActive: row.relation_type_is_active ?? false,
      }
    : null,
  disclosure: row.disclosure_id
    ? {
        disclosureId: row.disclosure_id,
        title: row.disclosure_title ?? "",
        disclosureDate: row.disclosure_date ?? "",
        url: row.disclosure_url ?? "",
        source: row.disclosure_source ?? "",
      }
    : null,
  rationale: row.rationale,
  status: row.status,
  basedOnSnapshotId: row.based_on_snapshot_id,
  applicability: { isApplicable: row.is_applicable, reason: row.applicability_reason },
  createdAt: row.created_at,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  resultingSnapshotId: row.resulting_snapshot_id,
});

/**
 * 검토 큐 목록 조회(spec 4-A, R-6). `limit=pageSize+1`로 조회해 hasMore를 판정하고
 * 초과 1행은 절단한다. flat RPC 행을 spec 응답 중첩 DTO로 변환한다.
 */
export const listProposals = async (
  deps: AdminLlmProposalRepositoryDeps,
  query: ProposalListQuery,
): Promise<HandlerResult<ProposalListResponse, AdminLlmProposalServiceError, unknown>> => {
  const pageSize = ADMIN_LLM_PROPOSALS_PAGE_SIZE;
  const offset = (query.page - 1) * pageSize;

  const readResult = await deps.listProposalRows({ status: query.status, limit: pageSize + 1, offset });
  if (!readResult.ok) {
    return failure(500, adminLlmProposalErrorCodes.proposalsFetchError, readResult.message);
  }

  const parsedRows: ProposalListRpcRow[] = [];
  for (const row of readResult.rows) {
    const rowCheck = ProposalListRpcRowSchema.safeParse(row);
    if (!rowCheck.success) {
      return failure(
        500,
        adminLlmProposalErrorCodes.proposalsFetchError,
        "제안 목록 데이터 형식이 올바르지 않습니다.",
        rowCheck.error.format(),
      );
    }
    parsedRows.push(rowCheck.data);
  }

  const hasMore = parsedRows.length > pageSize;
  const pageRows = hasMore ? parsedRows.slice(0, pageSize) : parsedRows;

  const response: ProposalListResponse = {
    items: pageRows.map(toListItem),
    page: query.page,
    pageSize,
    hasMore,
  };

  return success(response);
};

export type ApproveProposalParams = { proposalId: string; reviewerId: string };

/** 승인 outcome → HTTP 매핑(spec 4-B-9, R-9). */
export const approveProposal = async (
  deps: AdminLlmProposalRepositoryDeps,
  params: ApproveProposalParams,
): Promise<HandlerResult<ProposalApproveResponse, AdminLlmProposalServiceError, unknown>> => {
  const rpcResult = await deps.approveProposalRpc(params);
  if (!rpcResult.ok) {
    return failure(500, adminLlmProposalErrorCodes.approvalFailed, rpcResult.message);
  }

  const { row } = rpcResult;

  switch (row.outcome) {
    case "approved": {
      if (!row.resulting_snapshot_id || !row.effective_at) {
        return failure(
          500,
          adminLlmProposalErrorCodes.approvalFailed,
          "승인 결과가 필수 필드를 포함하지 않았습니다.",
        );
      }
      return success({
        proposalId: params.proposalId,
        status: "approved",
        resultingSnapshotId: row.resulting_snapshot_id,
        effectiveAt: row.effective_at,
      });
    }
    case "not_found":
      return failure(404, adminLlmProposalErrorCodes.proposalNotFound, "제안을 찾을 수 없습니다.");
    case "already_processed":
      return failure(
        409,
        adminLlmProposalErrorCodes.proposalAlreadyProcessed,
        "이미 처리된 제안입니다.",
      );
    case "conflict_invalidated":
      return failure(
        409,
        adminLlmProposalErrorCodes.proposalConflict,
        "최신 구성과 충돌해 제안이 자동으로 무효 처리되었습니다.",
        { reason: row.conflict_reason },
      );
    case "relation_type_inactive":
      return failure(
        422,
        adminLlmProposalErrorCodes.relationTypeInactive,
        "제안의 관계 종류가 비활성 상태입니다.",
      );
    case "chain_not_applicable":
      return failure(
        422,
        adminLlmProposalErrorCodes.chainNotApplicable,
        "대상 체인이 공식 밸류체인이 아니거나 보관 상태입니다.",
      );
    default:
      return failure(
        500,
        adminLlmProposalErrorCodes.approvalFailed,
        `알 수 없는 승인 결과입니다: ${row.outcome}`,
      );
  }
};

export type RejectProposalParams = { proposalId: string; reviewerId: string; reason?: string };

export type RejectProposalHandlerResult = HandlerResult<
  ProposalRejectResponse,
  AdminLlmProposalServiceError,
  unknown
> & { meta?: { reason: string } };

/**
 * 거부 처리(spec 4-C, BR-9). `reason`은 응답/DB에 포함하지 않고 `meta`로만 반환한다(R-2 —
 * 라우트가 로그로만 기록).
 */
export const rejectProposal = async (
  deps: AdminLlmProposalRepositoryDeps,
  params: RejectProposalParams,
): Promise<RejectProposalHandlerResult> => {
  const updateResult = await deps.rejectProposalPending({
    proposalId: params.proposalId,
    reviewerId: params.reviewerId,
  });

  if (!updateResult.ok) {
    return failure(500, adminLlmProposalErrorCodes.rejectionFailed, updateResult.message);
  }

  const meta = params.reason ? { reason: params.reason } : undefined;

  if (updateResult.updated) {
    const result = success<ProposalRejectResponse>({
      proposalId: params.proposalId,
      status: "rejected",
      reviewedAt: updateResult.updated.reviewed_at,
    });
    return meta ? { ...result, meta } : result;
  }

  // 0행 — 존재 여부에 따라 404/409 분기
  const statusResult = await deps.findProposalStatus(params.proposalId);
  if (!statusResult.ok) {
    return failure(500, adminLlmProposalErrorCodes.rejectionFailed, statusResult.message);
  }

  if (!statusResult.row) {
    return failure(404, adminLlmProposalErrorCodes.proposalNotFound, "제안을 찾을 수 없습니다.");
  }

  return failure(409, adminLlmProposalErrorCodes.proposalAlreadyProcessed, "이미 처리된 제안입니다.");
};
