/**
 * admin-batches 기능 에러 코드(spec §6.2 그대로).
 * 401/403 공통 Admin 인증 에러는 `@/backend/middleware/admin`의 `adminAuthErrorCodes` 소관(R-1).
 */
export const adminBatchesErrorCodes = {
  validationError: "VALIDATION_ERROR",
  runNotFound: "RUN_NOT_FOUND",
  internalError: "INTERNAL_ERROR",
} as const;

export type AdminBatchesServiceError =
  (typeof adminBatchesErrorCodes)[keyof typeof adminBatchesErrorCodes];
