import { REQUIRED_TERMS_DOC_TYPES, SUPPORTED_OAUTH_PROVIDERS } from "@iib/domain";
import { z } from "zod";

// ============================================
// Request Schema (camelCase)
// ============================================

/**
 * 회원가입 요청 스키마.
 * ※ password는 **형식 최소 검증만**(`z.string().min(1)`) 한다 — 비밀번호 정책 검증(8자 이상+영문+숫자)은
 *   `passwordSchema`를 서비스 계층(service.ts)에서만 재검증한다. 여기에 domain `passwordSchema`를
 *   내장하면 정책 위반이 스키마 단계 `INVALID_REQUEST`로 흡수되어 spec이 요구하는
 *   `AUTH_PASSWORD_POLICY_VIOLATION`(400) 오류 코드에 절대 도달할 수 없다(plan.md 모듈 7).
 *   같은 이유로 `passwordConfirm` 일치·약관 2종 포함 여부도 스키마가 아닌 서비스가 재검증한다.
 */
export const SignupRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "올바른 이메일 형식이 아닙니다." })),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
  passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
  termsAgreements: z.array(
    z.object({
      docType: z.enum(REQUIRED_TERMS_DOC_TYPES),
      docVersion: z.string().min(1),
    }),
  ),
  redirectTo: z.string().optional(),
});

export type SignupRequest = z.infer<typeof SignupRequestSchema>;

// ============================================
// Database Row Schema (snake_case)
// ============================================

/** `terms_agreements` 테이블(0002 마이그레이션)과 일치하는 행 스키마. */
export const TermsAgreementRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  doc_type: z.enum(REQUIRED_TERMS_DOC_TYPES),
  doc_version: z.string(),
  agreed_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TermsAgreementRow = z.infer<typeof TermsAgreementRowSchema>;

// ============================================
// Response Schema (camelCase)
// ============================================

/**
 * 가입 응답 스키마 — 계정 존재 여부와 무관하게 항상 동일한 형태(계정 열거 방지, E1).
 */
export const SignupResponseSchema = z.object({
  email: z.string(),
  verificationEmailSent: z.literal(true),
});

export type SignupResponse = z.infer<typeof SignupResponseSchema>;

// ============================================
// UC-002 로그인 — Request Schema (camelCase)
// ============================================

/**
 * 로그인 요청 스키마. 비밀번호는 형식(1자 이상) 검증만 한다 —
 * 로그인 시점에는 비밀번호 정책 강도를 재검증하지 않는다(spec Validation Rules).
 */
export const LoginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "올바른 이메일 형식이 아닙니다." })),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ============================================
// UC-002 로그인 — Database Row Schema (snake_case)
// ============================================

/** `profiles` 테이블(0002 마이그레이션)과 일치하는 행 스키마(로그인 응답 구성용). */
export const ProfileRowSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  role: z.enum(["user", "admin"]),
});

export type ProfileRow = z.infer<typeof ProfileRowSchema>;

// ============================================
// UC-002 로그인 — Response Schema (camelCase)
// ============================================

/** 로그인 응답 스키마 — 세션 토큰은 바디에 없다(Set-Cookie 전용). */
export const LoginResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.enum(["user", "admin"]),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// ============================================
// UC-003 Google 소셜 로그인 — Request/Response Schema
// ============================================

/** `:provider` 경로 파라미터 검증(BR-8) — MVP는 google만 허용. */
export const OAuthProviderParamSchema = z.enum(SUPPORTED_OAUTH_PROVIDERS);

export const OAuthStartRequestSchema = z.object({
  redirectPath: z.string().optional(),
});

export type OAuthStartRequest = z.infer<typeof OAuthStartRequestSchema>;

export const OAuthStartResponseSchema = z.object({
  authorizationUrl: z.string(),
});

export type OAuthStartResponse = z.infer<typeof OAuthStartResponseSchema>;

export const OAuthCallbackRequestSchema = z.object({
  code: z.string().min(1, "인가 코드가 필요합니다."),
  redirectPath: z.string().optional(),
});

export type OAuthCallbackRequest = z.infer<typeof OAuthCallbackRequestSchema>;

export const OAuthCallbackResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    role: z.enum(["user", "admin"]),
  }),
  isNewUser: z.boolean(),
  redirectPath: z.string(),
});

export type OAuthCallbackResponse = z.infer<typeof OAuthCallbackResponseSchema>;

// ============================================
// UC-004 비밀번호 재설정 — Request/Response Schema
// ============================================

export const PasswordResetRequestRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "올바른 이메일 형식이 아닙니다." })),
});

export type PasswordResetRequestRequest = z.infer<typeof PasswordResetRequestRequestSchema>;

export const PasswordResetRequestResponseSchema = z.object({
  message: z.string(),
});

export type PasswordResetRequestResponse = z.infer<typeof PasswordResetRequestResponseSchema>;

export const VerifyResetTokenRequestSchema = z.object({
  tokenHash: z.string().min(1, "토큰이 필요합니다."),
});

export type VerifyResetTokenRequest = z.infer<typeof VerifyResetTokenRequestSchema>;

export const VerifyResetTokenResponseSchema = z.object({
  verified: z.literal(true),
});

export type VerifyResetTokenResponse = z.infer<typeof VerifyResetTokenResponseSchema>;

/** 확인 값 일치는 FE 책임 — 요청에는 새 비밀번호만 포함한다(spec BR-5-3). */
export const ConfirmPasswordResetRequestSchema = z.object({
  newPassword: z.string().min(1, "새 비밀번호를 입력해 주세요."),
});

export type ConfirmPasswordResetRequest = z.infer<typeof ConfirmPasswordResetRequestSchema>;

export const ConfirmPasswordResetResponseSchema = z.object({
  message: z.string(),
});

export type ConfirmPasswordResetResponse = z.infer<typeof ConfirmPasswordResetResponseSchema>;

// ============================================
// UC-005 로그아웃 — Response Schema
// ============================================

/** 요청 스키마 없음(본문 없는 POST) — 이 계약을 명시하는 주석. */
export const LogoutResponseSchema = z.object({
  loggedOut: z.boolean(),
});

export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
