import { z } from "zod";

/**
 * admin-valuechains 기능 스키마(UC-021 plan 모듈 M8, spec API-1·API-5).
 * Query/RPC Row/Response 3계층 분리.
 */

// ============================================
// Query Schema
// ============================================

/** `includeArchived` 미지정 시 기본 true(보관 체인 포함) — 표시 필터는 service 담당. */
export const AdminChainListQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? true : v === "true")),
});
export type AdminChainListQuery = z.infer<typeof AdminChainListQuerySchema>;

export const ChainIdParamSchema = z.object({ chainId: z.string().uuid() });
export type ChainIdParam = z.infer<typeof ChainIdParamSchema>;

// ============================================
// RPC Row Schema (snake_case, admin_list_official_chains 반환과 1:1)
// ============================================

export const AdminChainListRpcRowSchema = z.object({
  chain_id: z.string().uuid(),
  name: z.string(),
  focus_type: z.enum(["industry", "company"]),
  focus_security_id: z.string().uuid().nullable(),
  is_archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  latest_snapshot_id: z.string().uuid().nullable(),
  latest_effective_at: z.string().nullable(),
  latest_change_source: z.enum(["user_save", "admin_edit", "llm_approval"]).nullable(),
  node_count: z.number().int().min(0),
});
export type AdminChainListRpcRow = z.infer<typeof AdminChainListRpcRowSchema>;

// ============================================
// Response Schema (camelCase, spec API-1)
// ============================================

const AdminChainLatestSnapshotSchema = z.object({
  snapshotId: z.string(),
  effectiveAt: z.string(),
  changeSource: z.enum(["user_save", "admin_edit", "llm_approval"]),
  nodeCount: z.number().int().min(0),
});

const AdminChainListItemSchema = z.object({
  chainId: z.string(),
  name: z.string(),
  focusType: z.enum(["industry", "company"]),
  focusSecurityId: z.string().nullable(),
  isArchived: z.boolean(),
  latestSnapshot: AdminChainLatestSnapshotSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminChainListItem = z.infer<typeof AdminChainListItemSchema>;

export const AdminChainListResponseSchema = z.object({
  chains: z.array(AdminChainListItemSchema),
});
export type AdminChainListResponse = z.infer<typeof AdminChainListResponseSchema>;

/** `DELETE /admin/valuechains/:chainId` 응답(spec API-5, 멱등 200). */
export const ArchiveChainResponseSchema = z.object({
  chainId: z.string(),
  isArchived: z.literal(true),
});
export type ArchiveChainResponse = z.infer<typeof ArchiveChainResponseSchema>;
