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

  // UC-002 로그인
  invalidCredentials: "AUTH_INVALID_CREDENTIALS",
  emailNotConfirmed: "AUTH_EMAIL_NOT_CONFIRMED",
  profileNotFound: "AUTH_PROFILE_NOT_FOUND",
  serviceError: "AUTH_SERVICE_ERROR",
  validationError: "AUTH_VALIDATION_ERROR",

  // UC-003 Google 소셜 로그인
  invalidRedirectPath: "AUTH_INVALID_REDIRECT_PATH",
  unsupportedProvider: "AUTH_UNSUPPORTED_PROVIDER",
  oauthStartFailed: "AUTH_OAUTH_START_FAILED",
  oauthExchangeFailed: "AUTH_OAUTH_EXCHANGE_FAILED",
  oauthEmailUnverified: "AUTH_OAUTH_EMAIL_UNVERIFIED",
  oauthProviderError: "AUTH_OAUTH_PROVIDER_ERROR",
  profileLoadFailed: "AUTH_PROFILE_LOAD_FAILED",

  // UC-004 비밀번호 재설정
  passwordResetInvalidEmail: "PASSWORD_RESET_INVALID_EMAIL",
  passwordResetRateLimited: "PASSWORD_RESET_RATE_LIMITED",
  passwordResetSendFailed: "PASSWORD_RESET_SEND_FAILED",
  passwordResetTokenInvalid: "PASSWORD_RESET_TOKEN_INVALID",
  passwordResetVerifyFailed: "PASSWORD_RESET_VERIFY_FAILED",
  passwordResetPolicyViolation: "PASSWORD_RESET_POLICY_VIOLATION",
  passwordResetSessionInvalid: "PASSWORD_RESET_SESSION_INVALID",
  passwordResetUpdateFailed: "PASSWORD_RESET_UPDATE_FAILED",

  // UC-005 로그아웃
  logoutFailed: "AUTH_LOGOUT_FAILED",
} as const;

export type AuthServiceError = (typeof authErrorCodes)[keyof typeof authErrorCodes];
