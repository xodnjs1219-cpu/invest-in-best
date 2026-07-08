import { z } from "zod";
import { CHAIN_LIST_PAGE_SIZE, DATA_SOURCE_LABELS, LIST_PAGE_LIMIT_MAX } from "@iib/domain";
import { createPaginationQuerySchema } from "@/backend/http/pagination";

/**
 * UC-009 밸류체인 뷰 조회 스키마 (spec BR-6, plan 모듈 B1).
 * Path param / DB Row(snake_case, 마이그레이션 0003~0006/0012와 1:1) / Response DTO(camelCase) 3계층 분리.
 * UC-010~012는 이 파일에 스키마를 **추가**한다(기존 심볼 수정 금지 — plan "다른 plan과의 경계").
 *
 * UC-007(메인/탐색 페이지 체인 카드 목록)의 스키마는 파일 하단 "체인 카드 목록" 섹션에 추가한다.
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

// ============================================
// 체인 카드 목록 (UC-007, plan 모듈 C-1)
// ============================================

/** `GET /valuechains/official`·`GET /valuechains/mine` 공용 쿼리 스키마(A-4 팩토리 재사용). */
export const ChainCardListQuerySchema = createPaginationQuerySchema({
  defaultLimit: CHAIN_LIST_PAGE_SIZE,
  maxLimit: LIST_PAGE_LIMIT_MAX,
});

export type ChainCardListQuery = z.infer<typeof ChainCardListQuerySchema>;

/** `list_chain_cards` RPC(0016 마이그레이션) 반환 행 — snake_case 1:1. */
export const ChainCardRpcRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  chain_type: z.enum(["official", "user"]),
  focus_type: z.enum(["industry", "company"]),
  focus_company_name: z.string().nullable(),
  node_count: z.coerce.number().int().min(0),
  metric_date: z.string().nullable(),
  total_market_cap_krw: z.string().nullable(),
  covered_node_count: z.number().int().nullable(),
  total_node_count: z.number().int().nullable(),
  is_carried_forward: z.boolean().nullable(),
  updated_at: z.string(),
  total_count: z.coerce.number().int().min(0),
});

export type ChainCardRpcRow = z.infer<typeof ChainCardRpcRowSchema>;

/** 카드 최신 지표(camelCase) — 집계 미존재/시세 장애 시 `latestMetric` 전체가 `null`(0과 구분, 엣지 3). */
export const ChainCardMetricSchema = z.object({
  metricDate: z.string(),
  totalMarketCapKrw: z.string(),
  coveredNodeCount: z.number().int().min(0),
  totalNodeCount: z.number().int().min(0),
  isCarriedForward: z.boolean(),
});

export type ChainCardMetric = z.infer<typeof ChainCardMetricSchema>;

export const ChainCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  chainType: z.enum(["official", "user"]),
  focusType: z.enum(["industry", "company"]),
  focusCompanyName: z.string().nullable(),
  nodeCount: z.number().int().min(0),
  latestMetric: ChainCardMetricSchema.nullable(),
  updatedAt: z.string(),
});

export type ChainCard = z.infer<typeof ChainCardSchema>;

export const ChainCardListResponseSchema = z.object({
  items: z.array(ChainCardSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalCount: z.number().int().min(0),
    hasMore: z.boolean(),
  }),
});

export type ChainCardListResponse = z.infer<typeof ChainCardListResponseSchema>;

// ============================================================================
// UC-010: 밸류체인 대시보드 패널(일별/분기 지표) 조회 스키마
// ============================================================================

// ── Query Schema (쿼리스트링 원본 — camelCase는 그대로) ──

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const DailyMetricsQuerySchema = z.object({
  from: z.string().regex(ISO_DATE_REGEX).optional(),
  to: z.string().regex(ISO_DATE_REGEX).optional(),
  at: z.string().regex(ISO_DATE_REGEX).optional(),
});
export type DailyMetricsQuery = z.infer<typeof DailyMetricsQuerySchema>;

export const QuarterlyMetricsQuerySchema = z
  .object({
    fromYear: z.coerce.number().int().optional(),
    fromQuarter: z.coerce.number().int().min(1).max(4).optional(),
    toYear: z.coerce.number().int().optional(),
    toQuarter: z.coerce.number().int().min(1).max(4).optional(),
    at: z.string().regex(ISO_DATE_REGEX).optional(),
  })
  .refine((v) => (v.fromYear === undefined) === (v.fromQuarter === undefined), {
    message: "fromYear/fromQuarter는 함께 지정해야 합니다.",
  })
  .refine((v) => (v.toYear === undefined) === (v.toQuarter === undefined), {
    message: "toYear/toQuarter는 함께 지정해야 합니다.",
  });
export type QuarterlyMetricsQuery = z.infer<typeof QuarterlyMetricsQuerySchema>;

// ── DB Row Schema (snake_case, 마이그레이션 0010과 1:1) ──

export const DailyMetricRowSchema = z.object({
  metric_date: z.string(),
  total_market_cap_krw: z.coerce.number().nullable(),
  covered_node_count: z.number().int(),
  total_node_count: z.number().int(),
  is_carried_forward: z.boolean(),
  based_on_snapshot_id: z.string().uuid().nullable(),
});
export type DailyMetricRow = z.infer<typeof DailyMetricRowSchema>;

export const QuarterlyMetricRowSchema = z.object({
  calendar_year: z.number().int(),
  calendar_quarter: z.number().int().min(1).max(4),
  total_revenue_krw: z.coerce.number().nullable(),
  covered_node_count: z.number().int(),
  total_node_count: z.number().int(),
  excluded_unmapped_count: z.number().int(),
  based_on_snapshot_id: z.string().uuid().nullable(),
});
export type QuarterlyMetricRow = z.infer<typeof QuarterlyMetricRowSchema>;

export const DailyAnnotationsRowSchema = z.object({
  shares_as_of_min: z.string().nullable(),
  shares_as_of_max: z.string().nullable(),
  all_closing_confirmed: z.boolean(),
});
export type DailyAnnotationsRow = z.infer<typeof DailyAnnotationsRowSchema>;

// ── Response DTO Schema (camelCase, spec §6.3) ──

const DailyMetricCurrentDtoSchema = z.object({
  metricDate: z.string(),
  totalMarketCapKrw: z.number().nullable(),
  coveredNodeCount: z.number().int(),
  totalNodeCount: z.number().int(),
  isCarriedForward: z.boolean(),
  basedOnSnapshotId: z.string().nullable(),
});

const DailyMetricPointDtoSchema = z.object({
  metricDate: z.string(),
  totalMarketCapKrw: z.number().nullable(),
  coveredNodeCount: z.number().int(),
  totalNodeCount: z.number().int(),
  isCarriedForward: z.boolean(),
});

const DailyAnnotationsDtoSchema = z.object({
  baseCurrency: z.literal("KRW"),
  fxBasis: z.literal("daily"),
  sharesAsOfDateMin: z.string().nullable(),
  sharesAsOfDateMax: z.string().nullable(),
  isClosingConfirmed: z.boolean(),
});

export const DailyMetricsResponseSchema = z.object({
  chainId: z.string(),
  current: DailyMetricCurrentDtoSchema.nullable(),
  series: z.array(DailyMetricPointDtoSchema),
  annotations: DailyAnnotationsDtoSchema,
});
export type DailyMetricsResponse = z.infer<typeof DailyMetricsResponseSchema>;
export type DailyMetricCurrent = z.infer<typeof DailyMetricCurrentDtoSchema>;
export type DailyMetricPoint = z.infer<typeof DailyMetricPointDtoSchema>;
export type DailyAnnotations = z.infer<typeof DailyAnnotationsDtoSchema>;

const QuarterlyMetricCurrentDtoSchema = z.object({
  calendarYear: z.number().int(),
  calendarQuarter: z.number().int(),
  totalRevenueKrw: z.number().nullable(),
  coveredNodeCount: z.number().int(),
  totalNodeCount: z.number().int(),
  excludedUnmappedCount: z.number().int(),
  basedOnSnapshotId: z.string().nullable(),
});

const QuarterlyMetricPointDtoSchema = z.object({
  calendarYear: z.number().int(),
  calendarQuarter: z.number().int(),
  totalRevenueKrw: z.number().nullable(),
  coveredNodeCount: z.number().int(),
  totalNodeCount: z.number().int(),
  excludedUnmappedCount: z.number().int(),
});

const QuarterlyAnnotationsDtoSchema = z.object({
  baseCurrency: z.literal("KRW"),
  fxBasis: z.literal("quarter_end"),
  revenueOverlapNotice: z.literal(true),
});

export const QuarterlyMetricsResponseSchema = z.object({
  chainId: z.string(),
  current: QuarterlyMetricCurrentDtoSchema.nullable(),
  series: z.array(QuarterlyMetricPointDtoSchema),
  annotations: QuarterlyAnnotationsDtoSchema,
});
export type QuarterlyMetricsResponse = z.infer<typeof QuarterlyMetricsResponseSchema>;
export type QuarterlyMetricCurrent = z.infer<typeof QuarterlyMetricCurrentDtoSchema>;
export type QuarterlyMetricPoint = z.infer<typeof QuarterlyMetricPointDtoSchema>;
export type QuarterlyAnnotations = z.infer<typeof QuarterlyAnnotationsDtoSchema>;

// ============================================================================
// UC-011: 노드 클릭 상호작용(노드 상세 조회) 스키마
// ============================================================================

export const NodeDetailParamsSchema = z.object({
  chainId: z.string().uuid(),
  nodeId: z.string().uuid(),
});
export type NodeDetailParams = z.infer<typeof NodeDetailParamsSchema>;

const NodeDetailSecurityRowSchema = z.object({
  id: z.string().uuid(),
  ticker: z.string(),
  market: z.enum(["KRX", "US"]),
  name: z.string(),
  listing_status: z.enum(["listed", "suspended", "delisted"]),
});

export const NodeDetailRowSchema = z.object({
  id: z.string().uuid(),
  snapshot_id: z.string().uuid(),
  node_kind: z.enum(["listed_company", "free_subject"]),
  group_id: z.string().uuid().nullable(),
  subject_name: z.string().nullable(),
  subject_type: z.enum(["consumer", "government", "private_company", "other"]).nullable(),
  subject_memo: z.string().nullable(),
  chain_snapshots: z.object({ chain_id: z.string().uuid() }),
  snapshot_groups: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  securities: NodeDetailSecurityRowSchema.nullable(),
});
export type NodeDetailRow = z.infer<typeof NodeDetailRowSchema>;

const NodeDetailGroupDtoSchema = z.object({
  groupId: z.string(),
  name: z.string(),
});

const NodeDetailFreeSubjectDtoSchema = z.object({
  name: z.string().nullable(),
  subjectType: z.enum(["consumer", "government", "private_company", "other"]).nullable(),
  memo: z.string().nullable(),
});

const NodeDetailSecurityDtoSchema = z.object({
  securityId: z.string(),
  ticker: z.string(),
  market: z.enum(["KRX", "US"]),
  name: z.string(),
  listingStatus: z.enum(["listed", "suspended", "delisted"]),
});

export const NodeDetailResponseSchema = z.object({
  nodeId: z.string(),
  snapshotId: z.string(),
  nodeKind: z.enum(["listed_company", "free_subject"]),
  group: NodeDetailGroupDtoSchema.nullable(),
  freeSubject: NodeDetailFreeSubjectDtoSchema.nullable(),
  security: NodeDetailSecurityDtoSchema.nullable(),
  securityResolved: z.boolean(),
});
export type NodeDetailResponse = z.infer<typeof NodeDetailResponseSchema>;

// ============================================================================
// UC-012: 시점 타임라인 조회(타임라인 메타/스냅샷 복원) 스키마
// ============================================================================

export const SnapshotAtQuerySchema = z.object({
  date: z.string(),
});
export type SnapshotAtQuery = z.infer<typeof SnapshotAtQuerySchema>;

export const SnapshotMarkerRowSchema = z.object({
  id: z.string().uuid(),
  effective_at: z.string(),
  change_source: z.enum(["user_save", "admin_edit", "llm_approval"]),
});
export type SnapshotMarkerRow = z.infer<typeof SnapshotMarkerRowSchema>;

const SnapshotAtRpcSecuritySchema = z.object({
  id: z.string().uuid(),
  ticker: z.string(),
  name: z.string(),
  market: z.enum(["KRX", "US"]),
  listing_status: z.enum(["listed", "suspended", "delisted"]),
});

const SnapshotAtRpcNodeSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid().nullable(),
  node_kind: z.enum(["listed_company", "free_subject"]),
  subject_name: z.string().nullable(),
  subject_type: z.enum(["consumer", "government", "private_company", "other"]).nullable(),
  subject_memo: z.string().nullable(),
  position_x: z.number().nullable(),
  position_y: z.number().nullable(),
  security: SnapshotAtRpcSecuritySchema.nullable(),
});

const SnapshotAtRpcRelationTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  is_directed: z.boolean(),
  is_active: z.boolean(),
});

const SnapshotAtRpcEdgeSchema = z.object({
  id: z.string().uuid(),
  source_node_id: z.string().uuid(),
  target_node_id: z.string().uuid(),
  relation_type: SnapshotAtRpcRelationTypeSchema,
});

const SnapshotAtRpcGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

/** `fn_chain_snapshot_at` RPC 반환 jsonb 스키마(snake_case, 0017 마이그레이션과 1:1). */
export const SnapshotAtRpcRowSchema = z.object({
  snapshot: z.object({
    id: z.string().uuid(),
    effective_at: z.string(),
    change_source: z.enum(["user_save", "admin_edit", "llm_approval"]),
  }),
  groups: z.array(SnapshotAtRpcGroupSchema),
  nodes: z.array(SnapshotAtRpcNodeSchema),
  edges: z.array(SnapshotAtRpcEdgeSchema),
});
export type SnapshotAtRpcRow = z.infer<typeof SnapshotAtRpcRowSchema>;

// ── Response DTO ──

export const TimelineMetaResponseSchema = z.object({
  range: z.object({ minDate: z.string(), maxDate: z.string() }),
  markers: z.array(
    z.object({
      snapshotId: z.string(),
      effectiveAt: z.string(),
      changeSource: z.enum(["user_save", "admin_edit", "llm_approval"]),
    }),
  ),
});
export type TimelineMetaResponse = z.infer<typeof TimelineMetaResponseSchema>;

const SnapshotAtNodeDtoSchema = z.object({
  id: z.string(),
  nodeKind: z.enum(["listed_company", "free_subject"]),
  groupId: z.string().nullable(),
  security: NodeDetailSecurityDtoSchema.nullable(),
  subjectName: z.string().nullable(),
  subjectType: z.enum(["consumer", "government", "private_company", "other"]).nullable(),
  subjectMemo: z.string().nullable(),
  positionX: z.number().nullable(),
  positionY: z.number().nullable(),
});

const SnapshotAtEdgeDtoSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  relationType: z.object({
    id: z.string(),
    name: z.string(),
    isDirected: z.boolean(),
    isActive: z.boolean(),
  }),
});

const SnapshotAtGroupDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const SnapshotAtDailyMetricDtoSchema = z.object({
  metricDate: z.string(),
  totalMarketCapKrw: z.string().nullable(),
  coveredNodeCount: z.number().int(),
  totalNodeCount: z.number().int(),
  isCarriedForward: z.boolean(),
});

const SnapshotAtQuarterlyMetricDtoSchema = z.object({
  calendarYear: z.number().int(),
  calendarQuarter: z.number().int(),
  totalRevenueKrw: z.string().nullable(),
  coveredNodeCount: z.number().int(),
  totalNodeCount: z.number().int(),
  excludedUnmappedCount: z.number().int(),
});

export const SnapshotAtResponseSchema = z.object({
  snapshot: z.object({
    snapshotId: z.string(),
    effectiveAt: z.string(),
    changeSource: z.enum(["user_save", "admin_edit", "llm_approval"]),
    groups: z.array(SnapshotAtGroupDtoSchema),
    nodes: z.array(SnapshotAtNodeDtoSchema),
    edges: z.array(SnapshotAtEdgeDtoSchema),
  }),
  metrics: z.object({
    daily: SnapshotAtDailyMetricDtoSchema.nullable(),
    quarterly: SnapshotAtQuarterlyMetricDtoSchema.nullable(),
  }),
});
export type SnapshotAtResponse = z.infer<typeof SnapshotAtResponseSchema>;

// ============================================================================
// UC-016: 편집 대상 체인 최신 구성 조회 (`GET /valuechains/:chainId/snapshots/latest`)
// ============================================================================

/** 편집 진입용 노드 DTO — `NodeDtoSchema`(뷰 전용)와 달리 `positionX/positionY`를 분리 보존한다. */
const LatestSnapshotNodeDtoSchema = z.object({
  id: z.string(),
  nodeKind: z.enum(["listed_company", "free_subject"]),
  groupId: z.string().nullable(),
  security: SecurityDtoSchema.nullable(),
  subjectName: z.string().nullable(),
  subjectType: z.enum(["consumer", "government", "private_company", "other"]).nullable(),
  subjectMemo: z.string().nullable(),
  positionX: z.number().nullable(),
  positionY: z.number().nullable(),
});

/** 편집 진입용 엣지 DTO — `relationTypeId`만 노출(방향 속성은 관계 종류 마스터에서 파생, BR-5). */
const LatestSnapshotEdgeDtoSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  relationTypeId: z.string(),
});

export const LatestSnapshotResponseSchema = z.object({
  chainId: z.string(),
  chainType: z.enum(["official", "user"]),
  name: z.string(),
  focusType: z.enum(["industry", "company"]),
  focusSecurity: FocusSecurityDtoSchema.nullable(),
  snapshotId: z.string(),
  effectiveAt: z.string(),
  groups: z.array(GroupDtoSchema),
  nodes: z.array(LatestSnapshotNodeDtoSchema),
  edges: z.array(LatestSnapshotEdgeDtoSchema),
});
export type LatestSnapshotResponse = z.infer<typeof LatestSnapshotResponseSchema>;
export type LatestSnapshotNode = z.infer<typeof LatestSnapshotNodeDtoSchema>;
export type LatestSnapshotEdge = z.infer<typeof LatestSnapshotEdgeDtoSchema>;
