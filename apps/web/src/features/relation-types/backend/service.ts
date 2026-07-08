import { failure, success, type HandlerResult } from "@/backend/http/response";
import {
  relationTypeErrorCodes,
  type RelationTypeServiceError,
} from "@/features/relation-types/backend/error";
import type { RelationTypeRepository } from "@/features/relation-types/backend/repository";
import {
  RelationTypeListResponseSchema,
  RelationTypeRowSchema,
  type RelationTypeListResponse,
} from "@/features/relation-types/backend/schema";

/**
 * 관계 종류 목록 조회(UC-016 API-1) 비즈니스 로직 — repository 인터페이스에만 의존한다.
 * 처리 순서: repository 조회 → 오류 시 500 FETCH_FAILED → row 스키마 검증(위반 시 500
 * VALIDATION_ERROR) → snake_case→camelCase 변환 → 응답 스키마 검증 → success().
 * 활성/비활성 구분은 데이터에 그대로 포함해 반환한다(FE가 라벨 렌더링/선택 목록을 분리 소비).
 */
export const getRelationTypes = async (
  repository: RelationTypeRepository,
  query: { activeOnly: boolean },
): Promise<HandlerResult<RelationTypeListResponse, RelationTypeServiceError, unknown>> => {
  const { rows, error } = await repository.findAllRelationTypes({ activeOnly: query.activeOnly });

  if (error) {
    return failure(500, relationTypeErrorCodes.fetchFailed, error);
  }

  const relationTypes: RelationTypeListResponse["relationTypes"] = [];
  for (const rawRow of rows) {
    const parsedRow = RelationTypeRowSchema.safeParse(rawRow);
    if (!parsedRow.success) {
      return failure(
        500,
        relationTypeErrorCodes.validationError,
        "관계 종류 데이터 형식이 올바르지 않습니다.",
        parsedRow.error.format(),
      );
    }
    const row = parsedRow.data;
    relationTypes.push({
      id: row.id,
      name: row.name,
      isDirected: row.is_directed,
      isActive: row.is_active,
    });
  }

  const parsedResponse = RelationTypeListResponseSchema.safeParse({ relationTypes });
  if (!parsedResponse.success) {
    return failure(
      500,
      relationTypeErrorCodes.validationError,
      "관계 종류 응답 데이터 형식이 올바르지 않습니다.",
      parsedResponse.error.format(),
    );
  }

  return success(parsedResponse.data);
};
