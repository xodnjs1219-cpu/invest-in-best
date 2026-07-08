import { relationTypeNameSchema } from "@iib/domain";
import { z } from "zod";

// ============================================
// Request Schema (camelCase)
// ============================================

/** `POST /admin/relation-types` 요청 스키마(spec API-2, BR-4 기본 유향). */
export const RelationTypeCreateRequestSchema = z
  .object({
    name: relationTypeNameSchema,
    isDirected: z.boolean().optional().default(true),
  })
  .strict();

export type RelationTypeCreateRequest = z.infer<typeof RelationTypeCreateRequestSchema>;

/**
 * `PATCH /admin/relation-types/:id` 요청 스키마(spec API-3).
 * `.strict()` — `isDirected` 등 미지 키 유입 시 400(R-6, BR-4 생성 후 방향성 변경 불가).
 * 최소 1개 필드 필수(spec "수정 필드 중 최소 1개 필수").
 */
export const RelationTypeUpdateRequestSchema = z
  .object({
    name: relationTypeNameSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.isActive !== undefined, {
    message: "수정할 필드를 최소 1개 이상 지정해야 합니다.",
  });

export type RelationTypeUpdateRequest = z.infer<typeof RelationTypeUpdateRequestSchema>;

/** 경로 파라미터 `:id` — UUID 형식만 허용. */
export const RelationTypeIdParamSchema = z.string().uuid();

// ============================================
// Database Row Schema (snake_case)
// ============================================

/** `admin_list_relation_types()` RPC가 반환하는 행과 1:1(M2 ②). */
export const AdminRelationTypeRpcRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  is_directed: z.boolean(),
  is_active: z.boolean(),
  is_in_use: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AdminRelationTypeRpcRow = z.infer<typeof AdminRelationTypeRpcRowSchema>;

/** `relation_types` INSERT/UPDATE가 반환하는 행(isInUse 없음 — 마스터 변경 시점엔 무관). */
export const RelationTypeRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  is_directed: z.boolean(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type RelationTypeRow = z.infer<typeof RelationTypeRowSchema>;

// ============================================
// Response Schema (camelCase, spec §6.2 그대로)
// ============================================

const AdminRelationTypeListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDirected: z.boolean(),
  isActive: z.boolean(),
  isInUse: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminRelationTypeListItem = z.infer<typeof AdminRelationTypeListItemSchema>;

export const AdminRelationTypeListResponseSchema = z.object({
  relationTypes: z.array(AdminRelationTypeListItemSchema),
});

export type AdminRelationTypeListResponse = z.infer<typeof AdminRelationTypeListResponseSchema>;

/** API-2(생성)·API-3(수정) 공용 응답(spec 계약 동일 구조). */
export const RelationTypeMutationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDirected: z.boolean(),
  isActive: z.boolean(),
});

export type RelationTypeMutationResponse = z.infer<typeof RelationTypeMutationResponseSchema>;
