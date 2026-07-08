import { z } from "zod";
import { AUTH_LOGIN_MESSAGES } from "@/features/auth/constants";
import type { LoginRequest } from "@/features/auth/backend/schema";

/**
 * 로그인 폼 필드 스키마 (react-hook-form `zodResolver`용).
 * 비밀번호는 형식 검증만 한다(정책 강도는 로그인에서 검증하지 않음 — spec Validation Rules).
 */
export const loginFormSchema = z.object({
  email: z.email({ message: AUTH_LOGIN_MESSAGES.emailInvalid }),
  password: z.string().min(1, AUTH_LOGIN_MESSAGES.passwordRequired),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

/** 폼 값을 백엔드 요청 형태로 매핑하는 순수 함수. */
export const toLoginRequest = (form: LoginFormValues): LoginRequest => ({
  email: form.email,
  password: form.password,
});
