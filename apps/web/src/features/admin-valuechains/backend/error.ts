/**
 * admin-valuechains 기능 에러 코드(UC-021 spec API-1·API-5).
 * 401/403 공통 Admin 인증 에러는 `@/backend/middleware/admin`의 `adminAuthErrorCodes` 소관(R-3).
 */
export const adminChainErrorCodes = {
  invalidRequest: "ADMIN_CHAINS.INVALID_REQUEST", // 400
  listFailed: "ADMIN_CHAINS.LIST_FAILED", // 500 (spec API-1)
  chainNotFound: "ADMIN_CHAINS.CHAIN_NOT_FOUND", // 404 (미존재/user 체인, R-7)
  archiveFailed: "ADMIN_CHAINS.ARCHIVE_FAILED", // 500 (spec API-5)
} as const;

export type AdminChainServiceError = (typeof adminChainErrorCodes)[keyof typeof adminChainErrorCodes];
