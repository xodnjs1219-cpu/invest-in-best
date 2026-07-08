import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminRelationTypeRpcRow, RelationTypeRow } from "@/features/admin-relation-types/backend/schema";

const RELATION_TYPES_TABLE = "relation_types";
const UNIQUE_VIOLATION_CODE = "23505";

export type RepositoryReadResult<T> = { ok: true; rows: T } | { ok: false; message: string };
export type RepositorySingleResult<T> = { ok: true; row: T } | { ok: false; message: string };

// ============================================
// listRelationTypesWithUsage
// ============================================

/**
 * `admin_list_relation_types()` RPC 호출 캡슐화(R-1 단일 SOT — isInUse 판정은 SQL 함수가 전담).
 */
export const listRelationTypesWithUsage = async (
  client: SupabaseClient,
): Promise<RepositoryReadResult<AdminRelationTypeRpcRow[]>> => {
  const { data, error } = await client.rpc("admin_list_relation_types");

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, rows: (data ?? []) as AdminRelationTypeRpcRow[] };
};

// ============================================
// findRelationTypeById
// ============================================

/** id 단건 조회(API-3 수정 대상 존재 확인, E6). */
export const findRelationTypeById = async (
  client: SupabaseClient,
  id: string,
): Promise<RepositorySingleResult<RelationTypeRow | null>> => {
  const { data, error } = await client
    .from(RELATION_TYPES_TABLE)
    .select("id, name, is_directed, is_active, created_at, updated_at")
    .eq("id", id)
    .maybeSingle<RelationTypeRow>();

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, row: data ?? null };
};

// ============================================
// findRelationTypeByName
// ============================================

/**
 * 이름 중복 사전 조회(BR-5 — 활성·비활성 전체 대상). `excludeId` 지정 시 자기 자신을 제외해
 * 이름 변경 시 "기존 이름과 동일한 재저장"을 중복으로 오판하지 않는다.
 * R-7 불변식(저장 name은 항상 정규화 값)을 전제로 동등 비교(`.eq`)만 사용한다.
 */
export const findRelationTypeByName = async (
  client: SupabaseClient,
  normalizedName: string,
  excludeId?: string,
): Promise<{ ok: true; duplicated: boolean } | { ok: false; message: string }> => {
  let query = client.from(RELATION_TYPES_TABLE).select("id").eq("name", normalizedName);
  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, duplicated: (data ?? []).length > 0 };
};

// ============================================
// insertRelationType
// ============================================

export type InsertRelationTypeParams = { name: string; isDirected: boolean };

export type InsertRelationTypeResult =
  | { kind: "created"; row: RelationTypeRow }
  | { kind: "duplicate" }
  | { kind: "error"; message: string };

/** 신규 관계 종류 생성(`is_active`는 컬럼 default true — spec Main-3-2, BR-4). */
export const insertRelationType = async (
  client: SupabaseClient,
  params: InsertRelationTypeParams,
): Promise<InsertRelationTypeResult> => {
  const { data, error } = await client
    .from(RELATION_TYPES_TABLE)
    .insert({ name: params.name, is_directed: params.isDirected })
    .select("id, name, is_directed, is_active, created_at, updated_at")
    .single<RelationTypeRow>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return { kind: "duplicate" };
    }
    return { kind: "error", message: error.message };
  }

  return { kind: "created", row: data };
};

// ============================================
// updateRelationType
// ============================================

export type UpdateRelationTypePatch = { name?: string; is_active?: boolean };

export type UpdateRelationTypeResult =
  | { kind: "updated"; row: RelationTypeRow }
  | { kind: "not_found" }
  | { kind: "duplicate" }
  | { kind: "error"; message: string };

/**
 * `name`/`is_active` 부분 수정(API-3). `updated_at`은 DB 트리거가 자동 갱신하므로
 * 앱에서 설정하지 않는다. 갱신 대상 0행이면 경합 방어 차원에서 `not_found`로 매핑한다.
 */
export const updateRelationType = async (
  client: SupabaseClient,
  id: string,
  patch: UpdateRelationTypePatch,
): Promise<UpdateRelationTypeResult> => {
  const { data, error } = await client
    .from(RELATION_TYPES_TABLE)
    .update(patch)
    .eq("id", id)
    .select("id, name, is_directed, is_active, created_at, updated_at")
    .maybeSingle<RelationTypeRow>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return { kind: "duplicate" };
    }
    return { kind: "error", message: error.message };
  }

  if (!data) {
    return { kind: "not_found" };
  }

  return { kind: "updated", row: data };
};
