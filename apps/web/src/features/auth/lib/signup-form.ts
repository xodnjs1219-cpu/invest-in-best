import { LEGAL_DOCS, REQUIRED_TERMS_DOC_TYPES, passwordSchema } from "@iib/domain";
import { z } from "zod";
import { AUTH_SIGNUP_MESSAGES } from "@/features/auth/constants";
import type { SignupRequest } from "@/features/auth/backend/schema";

/**
 * 가입 폼 필드 스키마 (react-hook-form `zodResolver`용).
 * FE 검증은 BE 서비스 재검증(schema.ts는 최소 검증만)과 별개로 사용자 경험을 위해 수행한다.
 */
export const signupFormSchema = z
  .object({
    email: z.email({ message: AUTH_SIGNUP_MESSAGES.emailInvalid }),
    password: passwordSchema,
    passwordConfirm: z.string().min(1),
    agreeTerms: z.literal(true, { message: AUTH_SIGNUP_MESSAGES.termsRequired }),
    agreePrivacy: z.literal(true, { message: AUTH_SIGNUP_MESSAGES.termsRequired }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: AUTH_SIGNUP_MESSAGES.passwordConfirmMismatch,
    path: ["passwordConfirm"],
  });

export type SignupFormValues = z.infer<typeof signupFormSchema>;

/**
 * 폼 값을 백엔드 요청 형태로 매핑하는 순수 함수.
 * 체크박스 2종 → termsAgreements 배열(docVersion은 LEGAL_DOCS 현행 버전을 FE도 참조 — 서버가 최종 강제).
 */
export const toSignupRequest = (form: SignupFormValues, redirectTo?: string): SignupRequest => ({
  email: form.email,
  password: form.password,
  passwordConfirm: form.passwordConfirm,
  termsAgreements: REQUIRED_TERMS_DOC_TYPES.map((docType) => ({
    docType,
    docVersion: LEGAL_DOCS[docType].version,
  })),
  ...(redirectTo ? { redirectTo } : {}),
});
