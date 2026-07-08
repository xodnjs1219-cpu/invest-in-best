import { PASSWORD_POLICY_MESSAGE } from "@iib/domain";

/**
 * auth(signup) 기능 UI 문구 상수 — 컴포넌트/훅 하드코딩 금지 규칙 이행.
 */
export const AUTH_SIGNUP_MESSAGES = {
  // 통일 안내 문구 (계정 열거 방지 — E1)
  successTitle: "가입이 완료되었습니다.",
  successBodyTemplate: (email: string) =>
    `${email}로 발송된 인증 메일을 확인해 주세요. 메일이 오지 않으면 스팸함을 확인하시거나, 로그인 화면에서 인증 메일을 다시 받아보실 수 있습니다.`,
  goToLogin: "로그인하러 가기",

  // 필드 오류 문구
  emailInvalid: "올바른 이메일 형식을 입력해 주세요.",
  passwordPolicyViolation: PASSWORD_POLICY_MESSAGE,
  passwordConfirmMismatch: "비밀번호가 일치하지 않습니다.",
  termsRequired: "필수 약관에 동의해 주세요.",

  // 서버 오류 문구
  rateLimited: "잠시 후 다시 시도해 주세요.",
  temporaryError: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  genericError: "가입 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",

  // 폼 라벨/버튼
  emailLabel: "이메일",
  passwordLabel: "비밀번호",
  passwordConfirmLabel: "비밀번호 확인",
  agreeTermsLabel: "이용약관에 동의합니다.",
  agreePrivacyLabel: "개인정보처리방침에 동의합니다.",
  submitLabel: "회원가입",
  submittingLabel: "가입 처리 중...",
} as const;

/** 인증 링크 무효/만료 안내 문구. */
export const AUTH_VERIFY_ERROR_MESSAGES = {
  title: "인증 링크가 유효하지 않습니다.",
  body: "링크가 만료되었거나 이미 사용되었을 수 있습니다. 로그인 화면에서 인증 메일을 다시 받아보실 수 있습니다.",
  goToLogin: "로그인 화면으로 이동",
} as const;

/**
 * auth(login, UC-002) 기능 UI 문구 상수.
 */
export const AUTH_LOGIN_MESSAGES = {
  // 필드 오류 문구
  emailInvalid: "올바른 이메일 형식을 입력해 주세요.",
  passwordRequired: "비밀번호를 입력해 주세요.",

  // 서버 오류 문구 (계정 열거 방지 통일 문구 — Google 대체 안내 포함, spec E1/A-5)
  invalidCredentials:
    "이메일 또는 비밀번호가 올바르지 않습니다. Google로 가입하셨다면 Google 로그인을 이용해 주세요.",
  emailNotConfirmed: "이메일 인증이 완료되지 않았습니다. 인증 메일을 확인해 주세요.",
  rateLimited: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  temporaryError: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  genericError: "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",

  // 폼 라벨/버튼
  emailLabel: "이메일",
  passwordLabel: "비밀번호",
  submitLabel: "로그인",
  submittingLabel: "로그인 중...",
  goToSignup: "회원가입",
  goToPasswordReset: "비밀번호를 잊으셨나요?",
} as const;

/** auth(로그아웃, UC-005) 기능 UI 문구 상수. */
export const AUTH_LOGOUT_MESSAGES = {
  menuLabel: "계정 메뉴",
  logoutLabel: "로그아웃",
  loggingOutLabel: "로그아웃 중...",
  serverErrorNotice: "로그아웃 처리 중 문제가 발생했으나 이 기기에서는 로그아웃되었습니다.",
  networkErrorNotice: "네트워크 오류로 로그아웃하지 못했습니다. 다시 시도해 주세요.",
  loginLabel: "로그인",
  signupLabel: "회원가입",
  adminMenuLabel: "관리자",
} as const;

/** auth(비밀번호 재설정, UC-004) 기능 UI 문구 상수. */
export const AUTH_PASSWORD_RESET_MESSAGES = {
  // 요청 단계
  requestTitle: "비밀번호 재설정",
  requestEmailLabel: "이메일",
  requestSubmitLabel: "재설정 메일 보내기",
  requestSubmittingLabel: "전송 중...",

  // 발송 안내 (통일 문구 — 계정 열거 방지)
  sentTitle: "메일을 확인해 주세요",
  sentBody:
    "입력하신 주소로 안내 메일을 발송했습니다. 메일함을 확인해 주세요. 링크는 1시간 동안 유효합니다.",
  backToRequest: "다시 요청",

  // 새 비밀번호 단계
  newPasswordTitle: "새 비밀번호 설정",
  newPasswordLabel: "새 비밀번호",
  newPasswordConfirmLabel: "새 비밀번호 확인",
  newPasswordSubmitLabel: "비밀번호 변경",
  newPasswordSubmittingLabel: "변경 중...",

  // 무효 안내 (통일 문구 — 사유 미구분)
  invalidTitle: "링크가 유효하지 않습니다",
  invalidBody: "링크가 만료되었거나 이미 사용되었을 수 있습니다. 재설정을 다시 요청해 주세요.",
  requestAgain: "재설정 다시 요청",

  // 완료 안내
  successTitle: "비밀번호가 재설정되었습니다",
  successBody: "새 비밀번호로 로그인해 주세요. 다른 기기에 로그인되어 있었다면 모두 로그아웃되었습니다.",
  goToLogin: "로그인하러 가기",

  // 오류 문구
  rateLimited: "요청이 잦습니다. 잠시 후 다시 시도해 주세요.",
  temporaryError: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  verifying: "링크를 확인하는 중...",
} as const;

/** auth(Google OAuth, UC-003) 기능 UI 문구 상수. */
export const AUTH_OAUTH_MESSAGES = {
  googleButtonLabel: "Google로 로그인",
  googleButtonLoadingLabel: "이동 중...",
  consentNotice: "계속하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.",

  processing: "로그인 처리 중...",
  cancelledNotice: "Google 로그인이 취소되었습니다.",
  exchangeFailed: "인증이 거부되었습니다. 다시 Google로 로그인해 주세요.",
  emailUnverified: "Google 계정의 이메일을 확인할 수 없어 가입이 제한됩니다. 이메일로 가입해 주세요.",
  providerError: "일시적인 오류가 발생했습니다. 이메일 로그인을 이용해 주세요.",
  genericError: "로그인 처리 중 문제가 발생했습니다.",

  goToEmailLogin: "이메일로 로그인",
  goToEmailSignup: "이메일로 가입하기",
  retryGoogleLogin: "다시 Google로 로그인",
} as const;
