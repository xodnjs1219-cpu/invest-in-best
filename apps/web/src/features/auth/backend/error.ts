/**
 * auth 기능 에러 코드 (spec Error Codes 그대로).
 * UC-002~006이 같은 파일에 코드를 추가하는 공용 위치 — 본 plan(UC-001)은 아래 7개만 정의한다.
 */
export const authErrorCodes = {
  invalidRequest: "INVALID_REQUEST",
  passwordPolicyViolation: "AUTH_PASSWORD_POLICY_VIOLATION",
  passwordConfirmMismatch: "AUTH_PASSWORD_CONFIRM_MISMATCH",
  termsNotAgreed: "AUTH_TERMS_NOT_AGREED",
  rateLimited: "AUTH_RATE_LIMITED",
  signupFailed: "AUTH_SIGNUP_FAILED",
  termsSaveFailed: "AUTH_TERMS_SAVE_FAILED",
} as const;

export type AuthServiceError = (typeof authErrorCodes)[keyof typeof authErrorCodes];
