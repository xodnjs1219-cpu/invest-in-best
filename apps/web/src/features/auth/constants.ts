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
