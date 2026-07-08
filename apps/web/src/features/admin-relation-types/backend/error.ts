/**
 * admin-relation-types 기능 에러 코드(spec §6.2 Error Codes 그대로).
 * 401/403 공통 Admin 인증 에러는 `@/backend/middleware/admin`의 `adminAuthErrorCodes` 소관.
 */
export const adminRelationTypeErrorCodes = {
  validationError: "VALIDATION_ERROR",
  notFound: "RELATION_TYPE_NOT_FOUND",
  nameDuplicate: "RELATION_TYPE_NAME_DUPLICATE",
  methodNotAllowed: "METHOD_NOT_ALLOWED",
  internalError: "INTERNAL_ERROR",
} as const;

export type AdminRelationTypeServiceError =
  (typeof adminRelationTypeErrorCodes)[keyof typeof adminRelationTypeErrorCodes];
