import { z } from "zod";

/**
 * relation-types(관계 종류 목록 조회, UC-016 API-1) Zod 스키마.
 * Query/Row(snake_case)/Response(camelCase) 3계층 분리(hono-backend-guide 컨벤션).
 * UC-024(어드민 관리 API)는 별도 feature(`admin-relation-types`) 소관 — 본 스키마는 조회 전용.
 */

// ============================================
// Query Schema
// ============================================

/** `active` 쿼리 파라미터 — 'true'/'false' 문자열만 허용 후 boolean으로 변환. 미지정 시 전체 반환. */
export const RelationTypeListQuerySchema = z.object({
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type RelationTypeListQuery = z.infer<typeof RelationTypeListQuerySchema>;

// ============================================
// DB Row Schema (snake_case — 0004_relation_types.sql과 1:1)
// ============================================

export const RelationTypeRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  is_directed: z.boolean(),
  is_active: z.boolean(),
});

export type RelationTypeRow = z.infer<typeof RelationTypeRowSchema>;

// ============================================
// Response DTO Schema (camelCase)
// ============================================

export const RelationTypeDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDirected: z.boolean(),
  isActive: z.boolean(),
});

export type RelationTypeDto = z.infer<typeof RelationTypeDtoSchema>;

export const RelationTypeListResponseSchema = z.object({
  relationTypes: z.array(RelationTypeDtoSchema),
});

export type RelationTypeListResponse = z.infer<typeof RelationTypeListResponseSchema>;
