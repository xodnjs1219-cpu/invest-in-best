/**
 * account(회원 탈퇴, UC-006) 기능 에러 코드.
 * 401 UNAUTHORIZED는 라우트 계층 공통 코드로 route.ts에서 직접 사용한다(중복 방지).
 */
export const accountErrorCodes = {
  unauthorized: "UNAUTHORIZED",
  soleAdminBlocked: "SOLE_ADMIN_WITHDRAWAL_BLOCKED",
  withdrawalFailed: "ACCOUNT_WITHDRAWAL_FAILED",
  validationError: "ACCOUNT_VALIDATION_ERROR",
} as const;

export type AccountServiceError = (typeof accountErrorCodes)[keyof typeof accountErrorCodes];
