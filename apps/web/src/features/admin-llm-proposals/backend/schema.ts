import {
  ADMIN_LLM_PROPOSALS_PAGE_SIZE,
  LLM_PROPOSAL_STATUSES,
  LLM_PROPOSAL_TYPES,
  REJECT_REASON_MAX_LENGTH,
} from "@iib/domain";
import { z } from "zod";

// ============================================
// Request Schema (camelCase)
// ============================================

/** `GET /admin/llm-proposals` 쿼리 스키마 — status 기본 pending, page 기본 1. */
export const ProposalListQuerySchema = z.object({
  status: z.enum(LLM_PROPOSAL_STATUSES).default("pending"),
  page: z.coerce.number().int().min(1).default(1),
});

export type ProposalListQuery = z.infer<typeof ProposalListQuerySchema>;

/** 경로 파라미터 `:proposalId` — UUID 형식만 허용. */
export const ProposalIdParamSchema = z.string().uuid();

/** `POST /admin/llm-proposals/:proposalId/reject` 요청 바디 — reason은 선택(R-2, 영속화 없이 로그 전용). */
export const ProposalRejectRequestSchema = z.object({
  reason: z.string().max(REJECT_REASON_MAX_LENGTH).optional(),
});

export type ProposalRejectRequest = z.infer<typeof ProposalRejectRequestSchema>;

// ============================================
// Database RPC Row Schema (snake_case)
// ============================================

/** `list_llm_proposals()` RPC가 반환하는 flat 행(1:1). nullable 컬럼은 delete/비-pending 방어(R-4, R-6). */
export const ProposalListRpcRowSchema = z.object({
  proposal_id: z.string().uuid(),
  chain_id: z.string().uuid(),
  chain_name: z.string(),
  proposal_type: z.enum(LLM_PROPOSAL_TYPES),
  status: z.enum(LLM_PROPOSAL_STATUSES),
  source_node_id: z.string().uuid(),
  source_display_name: z.string(),
  source_node_kind: z.enum(["listed_company", "free_subject"]),
  source_ticker: z.string().nullable(),
  target_node_id: z.string().uuid(),
  target_display_name: z.string(),
  target_node_kind: z.enum(["listed_company", "free_subject"]),
  target_ticker: z.string().nullable(),
  relation_type_id: z.string().uuid().nullable(),
  relation_type_name: z.string().nullable(),
  relation_type_is_active: z.boolean().nullable(),
  disclosure_id: z.string().uuid().nullable(),
  disclosure_title: z.string().nullable(),
  disclosure_date: z.string().nullable(),
  disclosure_url: z.string().nullable(),
  disclosure_source: z.string().nullable(),
  rationale: z.string(),
  based_on_snapshot_id: z.string().uuid(),
  created_at: z.string(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().nullable(),
  resulting_snapshot_id: z.string().uuid().nullable(),
  is_applicable: z.boolean(),
  applicability_reason: z.string().nullable(),
});

export type ProposalListRpcRow = z.infer<typeof ProposalListRpcRowSchema>;

/** `approve_llm_proposal()` RPC가 반환하는 단일 행. */
export const ApproveRpcRowSchema = z.object({
  outcome: z.string(),
  conflict_reason: z.string().nullable(),
  resulting_snapshot_id: z.string().nullable(),
  effective_at: z.string().nullable(),
});

export type ApproveRpcRow = z.infer<typeof ApproveRpcRowSchema>;

// ============================================
// Response Schema (camelCase, spec §6.2 그대로)
// ============================================

const NodeSummarySchema = z.object({
  nodeId: z.string(),
  displayName: z.string(),
  nodeKind: z.enum(["listed_company", "free_subject"]),
  ticker: z.string().nullable(),
});

const RelationTypeSummarySchema = z.object({
  relationTypeId: z.string(),
  name: z.string(),
  isActive: z.boolean(),
});

const DisclosureSummarySchema = z.object({
  disclosureId: z.string(),
  title: z.string(),
  disclosureDate: z.string(),
  url: z.string(),
  source: z.string(),
});

const ApplicabilitySchema = z.object({
  isApplicable: z.boolean(),
  reason: z.string().nullable(),
});

const ProposalListItemSchema = z.object({
  proposalId: z.string(),
  chain: z.object({ chainId: z.string(), name: z.string() }),
  proposalType: z.enum(LLM_PROPOSAL_TYPES),
  sourceNode: NodeSummarySchema,
  targetNode: NodeSummarySchema,
  relationType: RelationTypeSummarySchema.nullable(),
  disclosure: DisclosureSummarySchema.nullable(),
  rationale: z.string(),
  status: z.enum(LLM_PROPOSAL_STATUSES),
  basedOnSnapshotId: z.string(),
  applicability: ApplicabilitySchema,
  createdAt: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  resultingSnapshotId: z.string().nullable(),
});

export type ProposalListItem = z.infer<typeof ProposalListItemSchema>;

export const ProposalListResponseSchema = z.object({
  items: z.array(ProposalListItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  hasMore: z.boolean(),
});

export type ProposalListResponse = z.infer<typeof ProposalListResponseSchema>;

export const ProposalApproveResponseSchema = z.object({
  proposalId: z.string(),
  status: z.literal("approved"),
  resultingSnapshotId: z.string(),
  effectiveAt: z.string(),
});

export type ProposalApproveResponse = z.infer<typeof ProposalApproveResponseSchema>;

export const ProposalRejectResponseSchema = z.object({
  proposalId: z.string(),
  status: z.literal("rejected"),
  reviewedAt: z.string(),
});

export type ProposalRejectResponse = z.infer<typeof ProposalRejectResponseSchema>;

/** `listProposalRows` 저장소 함수의 페이지네이션 파라미터 — 상수 재노출(하드코딩 금지). */
export const DEFAULT_PROPOSAL_PAGE_SIZE = ADMIN_LLM_PROPOSALS_PAGE_SIZE;
