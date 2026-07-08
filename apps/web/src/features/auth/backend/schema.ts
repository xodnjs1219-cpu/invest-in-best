import { REQUIRED_TERMS_DOC_TYPES } from "@iib/domain";
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
