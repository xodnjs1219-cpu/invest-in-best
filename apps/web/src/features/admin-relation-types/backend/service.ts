import { failure, success, type HandlerResult } from "@/backend/http/response";
import {
  adminRelationTypeErrorCodes,
  type AdminRelationTypeServiceError,
} from "@/features/admin-relation-types/backend/error";
import type {
  InsertRelationTypeParams,
  InsertRelationTypeResult,
  RepositoryReadResult,
  RepositorySingleResult,
  UpdateRelationTypePatch,
  UpdateRelationTypeResult,
} from "@/features/admin-relation-types/backend/repository";
import {
  AdminRelationTypeRpcRowSchema,
  type AdminRelationTypeListItem,
  type AdminRelationTypeListResponse,
  type AdminRelationTypeRpcRow,
  type RelationTypeCreateRequest,
  type RelationTypeMutationResponse,
  type RelationTypeRow,
  type RelationTypeUpdateRequest,
} from "@/features/admin-relation-types/backend/schema";

/**
 * service가 의존하는 repository 함수 시그니처 — 테스트에서 mock 주입이 가능하도록
 * 인터페이스 타입으로 분리한다(service.ts는 Supabase 쿼리 문법을 알지 못한다).
 */
export type AdminRelationTypeRepositoryDeps = {
  listRelationTypesWithUsage: () => Promise<RepositoryReadResult<AdminRelationTypeRpcRow[]>>;
  findRelationTypeById: (id: string) => Promise<RepositorySingleResult<RelationTypeRow | null>>;
  findRelationTypeByName: (
    normalizedName: string,
    excludeId?: string,
  ) => Promise<{ ok: true; duplicated: boolean } | { ok: false; message: string }>;
  insertRelationType: (params: InsertRelationTypeParams) => Promise<InsertRelationTypeResult>;
  updateRelationType: (id: string, patch: UpdateRelationTypePatch) => Promise<UpdateRelationTypeResult>;
};

const toListItem = (row: AdminRelationTypeRpcRow): AdminRelationTypeListItem => ({
  id: row.id,
  name: row.name,
  isDirected: row.is_directed,
  isActive: row.is_active,
  isInUse: row.is_in_use,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toMutationResponse = (row: RelationTypeRow): RelationTypeMutationResponse => ({
  id: row.id,
  name: row.name,
  isDirected: row.is_directed,
  isActive: row.is_active,
});

/**
 * 마스터 목록 조회(spec Main-2, R-1). RPC 오류·행 스키마 위반은 모두 500으로 매핑한다.
 * 빈 배열도 정상 200(시드 이전 상태 허용).
 */
export const listRelationTypes = async (
  deps: AdminRelationTypeRepositoryDeps,
): Promise<HandlerResult<AdminRelationTypeListResponse, AdminRelationTypeServiceError, unknown>> => {
  const readResult = await deps.listRelationTypesWithUsage();
  if (!readResult.ok) {
    return failure(500, adminRelationTypeErrorCodes.internalError, readResult.message);
  }

  const parsedRows: AdminRelationTypeRpcRow[] = [];
  for (const row of readResult.rows) {
    const rowCheck = AdminRelationTypeRpcRowSchema.safeParse(row);
    if (!rowCheck.success) {
      return failure(
        500,
        adminRelationTypeErrorCodes.internalError,
        "관계 종류 목록 데이터 형식이 올바르지 않습니다.",
        rowCheck.error.format(),
      );
    }
    parsedRows.push(rowCheck.data);
  }

  return success({ relationTypes: parsedRows.map(toListItem) });
};

/**
 * 관계 종류 추가(spec Main-3, API-2). 사전 중복 검사 → INSERT 순으로 진행하며,
 * INSERT 시점의 유니크 위반(레이스, R-2)도 동일하게 409로 매핑한다.
 */
export const createRelationType = async (
  deps: AdminRelationTypeRepositoryDeps,
  input: RelationTypeCreateRequest,
): Promise<HandlerResult<RelationTypeMutationResponse, AdminRelationTypeServiceError, unknown>> => {
  const duplicateCheck = await deps.findRelationTypeByName(input.name);
  if (!duplicateCheck.ok) {
    return failure(500, adminRelationTypeErrorCodes.internalError, duplicateCheck.message);
  }
  if (duplicateCheck.duplicated) {
    return failure(
      409,
      adminRelationTypeErrorCodes.nameDuplicate,
      "이미 존재하는 관계 종류 이름입니다.",
    );
  }

  const insertResult = await deps.insertRelationType({ name: input.name, isDirected: input.isDirected });

  switch (insertResult.kind) {
    case "created":
      return success(toMutationResponse(insertResult.row), 201);
    case "duplicate":
      return failure(
        409,
        adminRelationTypeErrorCodes.nameDuplicate,
        "이미 존재하는 관계 종류 이름입니다.",
      );
    case "error":
      return failure(500, adminRelationTypeErrorCodes.internalError, insertResult.message);
  }
};

/**
 * 관계 종류 수정 — 이름 변경/비활성화/재활성화(spec Main-4~6, API-3).
 * 이름이 기존과 동일하면 중복 검사를 생략한다(no-op rename 허용).
 * 비활성화/재활성화는 사용 중 여부와 무관하게 허용하며 엣지·스냅샷에 어떤 쓰기도 하지 않는다(BR-2·BR-7).
 */
export const updateRelationType = async (
  deps: AdminRelationTypeRepositoryDeps,
  id: string,
  patch: RelationTypeUpdateRequest,
): Promise<HandlerResult<RelationTypeMutationResponse, AdminRelationTypeServiceError, unknown>> => {
  const existingResult = await deps.findRelationTypeById(id);
  if (!existingResult.ok) {
    return failure(500, adminRelationTypeErrorCodes.internalError, existingResult.message);
  }
  if (!existingResult.row) {
    return failure(404, adminRelationTypeErrorCodes.notFound, "관계 종류를 찾을 수 없습니다.");
  }

  const nameChanged = patch.name !== undefined && patch.name !== existingResult.row.name;
  if (nameChanged) {
    const duplicateCheck = await deps.findRelationTypeByName(patch.name as string, id);
    if (!duplicateCheck.ok) {
      return failure(500, adminRelationTypeErrorCodes.internalError, duplicateCheck.message);
    }
    if (duplicateCheck.duplicated) {
      return failure(
        409,
        adminRelationTypeErrorCodes.nameDuplicate,
        "이미 존재하는 관계 종류 이름입니다.",
      );
    }
  }

  const updatePatch: UpdateRelationTypePatch = {};
  if (patch.name !== undefined) {
    updatePatch.name = patch.name;
  }
  if (patch.isActive !== undefined) {
    updatePatch.is_active = patch.isActive;
  }

  const updateResult = await deps.updateRelationType(id, updatePatch);

  switch (updateResult.kind) {
    case "updated":
      return success(toMutationResponse(updateResult.row), 200);
    case "not_found":
      return failure(404, adminRelationTypeErrorCodes.notFound, "관계 종류를 찾을 수 없습니다.");
    case "duplicate":
      return failure(
        409,
        adminRelationTypeErrorCodes.nameDuplicate,
        "이미 존재하는 관계 종류 이름입니다.",
      );
    case "error":
      return failure(500, adminRelationTypeErrorCodes.internalError, updateResult.message);
  }
};
