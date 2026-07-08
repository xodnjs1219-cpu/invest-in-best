import { z } from "zod";
import { DATA_SOURCE_LABELS } from "@iib/domain";

/**
 * UC-009 밸류체인 뷰 조회 스키마 (spec BR-6, plan 모듈 B1).
 * Path param / DB Row(snake_case, 마이그레이션 0003~0006/0012와 1:1) / Response DTO(camelCase) 3계층 분리.
 * UC-010~012는 이 파일에 스키마를 **추가**한다(기존 심볼 수정 금지 — plan "다른 plan과의 경계").
 */

// ============================================
// Path Param Schema
// ============================================

export const ChainIdParamSchema = z.object({
  chainId: z.string().uuid(),
});

export type ChainIdParam = z.infer<typeof ChainIdParamSchema>;

// ============================================
// DB Row Schema (snake_case)
// ============================================

const FocusSecurityRowSchema = z.object({
  id: z.string().uuid(),
  ticker: z.string(),
  name: z.string(),
  market: z.enum(["KRX", "US"]),
});

export const ValueChainRowSchema = z.object({
  id: z.string().uuid(),
  chain_type: z.enum(["official", "user"]),
  owner_id: z.string().uuid().nullable(),
  name: z.string(),
  focus_type: z.enum(["industry", "company"]),
  focus_security_id: z.string().uuid().nullable(),
  is_archived: z.boolean(),
  source_chain_id: z.string().uuid().nullable(),
  focus_security: FocusSecurityRowSchema.nullable().optional(),
});

export type ValueChainRow = z.infer<typeof ValueChainRowSchema>;

export const ChainSnapshotRowSchema = z.object({
  id: z.string().uuid(),
  chain_id: z.string().uuid(),
  effective_at: z.string(),
  change_source: z.enum(["user_save", "admin_edit", "llm_approval"]),
});

export type ChainSnapshotRow = z.infer<typeof ChainSnapshotRowSchema>;

export const SnapshotGroupRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type SnapshotGroupRow = z.infer<typeof SnapshotGroupRowSchema>;

const SecurityNodeRowSchema = z.object({
  id: z.string().uuid(),
  ticker: z.string(),
  name: z.string(),
  market: z.enum(["KRX", "US"]),
  listing_status: z.enum(["listed", "suspended", "delisted"]),
});

export const SnapshotNodeRowSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid().nullable(),
  node_kind: z.enum(["listed_company", "free_subject"]),
  security_id: z.string().uuid().nullable(),
  subject_name: z.string().nullable(),
  subject_type: z.enum(["consumer", "government", "private_company", "other"]).nullable(),
  subject_memo: z.string().nullable(),
  position_x: z.number().nullable(),
  position_y: z.number().nullable(),
  security: SecurityNodeRowSchema.nullable().optional(),
});

export type SnapshotNodeRow = z.infer<typeof SnapshotNodeRowSchema>;

const RelationTypeRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  is_directed: z.boolean(),
  is_active: z.boolean(),
});

export const SnapshotEdgeRowSchema = z.object({
  id: z.string().uuid(),
  source_node_id: z.string().uuid(),
  target_node_id: z.string().uuid(),
  relation_type: RelationTypeRowSchema,
});

export type SnapshotEdgeRow = z.infer<typeof SnapshotEdgeRowSchema>;

export const BatchRunFreshnessRowSchema = z.object({
  finished_at: z.string().nullable(),
});

export type BatchRunFreshnessRow = z.infer<typeof BatchRunFreshnessRowSchema>;

// ============================================
// Response DTO Schema (camelCase, spec BR-6)
// ============================================

const FocusSecurityDtoSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  name: z.string(),
  market: z.enum(["KRX", "US"]),
});

const ChainDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  chainType: z.enum(["official", "user"]),
  focusType: z.enum(["industry", "company"]),
  focusSecurity: FocusSecurityDtoSchema.nullable(),
  isOwner: z.boolean(),
});

const SnapshotDtoSchema = z.object({
  id: z.string(),
  effectiveAt: z.string(),
  changeSource: z.enum(["user_save", "admin_edit", "llm_approval"]),
});

const GroupDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const NodePositionDtoSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const SecurityDtoSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  name: z.string(),
  market: z.enum(["KRX", "US"]),
  listingStatus: z.enum(["listed", "suspended", "delisted"]),
});

const NodeDtoSchema = z.object({
  id: z.string(),
  groupId: z.string().nullable(),
  nodeKind: z.enum(["listed_company", "free_subject"]),
  security: SecurityDtoSchema.nullable(),
  subjectName: z.string().nullable(),
  subjectType: z.enum(["consumer", "government", "private_company", "other"]).nullable(),
  subjectMemo: z.string().nullable(),
  position: NodePositionDtoSchema.nullable(),
});

const RelationTypeDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDirected: z.boolean(),
  isActive: z.boolean(),
});

const EdgeDtoSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  relationType: RelationTypeDtoSchema,
});

const DataFreshnessDtoSchema = z.object({
  sources: z.array(z.string()).default([...DATA_SOURCE_LABELS]),
  lastCollectedAt: z.object({
    quotes: z.string().nullable(),
    financials: z.string().nullable(),
    fxAndMarketHours: z.string().nullable(),
  }),
});

export const ChainViewResponseSchema = z.object({
  chain: ChainDtoSchema,
  snapshot: SnapshotDtoSchema,
  groups: z.array(GroupDtoSchema),
  nodes: z.array(NodeDtoSchema),
  edges: z.array(EdgeDtoSchema),
  dataFreshness: DataFreshnessDtoSchema,
});

export type ChainViewResponse = z.infer<typeof ChainViewResponseSchema>;
export type ChainViewChain = z.infer<typeof ChainDtoSchema>;
export type ChainViewSnapshot = z.infer<typeof SnapshotDtoSchema>;
export type ChainViewGroup = z.infer<typeof GroupDtoSchema>;
export type ChainViewNode = z.infer<typeof NodeDtoSchema>;
export type ChainViewEdge = z.infer<typeof EdgeDtoSchema>;
export type DataFreshness = z.infer<typeof DataFreshnessDtoSchema>;
