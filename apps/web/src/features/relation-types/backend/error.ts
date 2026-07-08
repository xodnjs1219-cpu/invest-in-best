/**
 * relation-types(UC-016 API-1) 기능 에러 코드.
 * 401(AUTH_REQUIRED)은 공통 인증 미들웨어 소관 — 여기서는 정의하지 않는다.
 */
export const relationTypeErrorCodes = {
  unauthorized: "RELATION_TYPES.UNAUTHORIZED", // 401 — 미로그인/세션 만료(E9)
  invalidQuery: "RELATION_TYPES.INVALID_QUERY", // 400
  fetchFailed: "RELATION_TYPES.FETCH_FAILED", // 500 (E10)
  validationError: "RELATION_TYPES.VALIDATION_ERROR", // 500 (row/DTO 스키마 위반)
} as const;

export type RelationTypeServiceError =
  (typeof relationTypeErrorCodes)[keyof typeof relationTypeErrorCodes];
