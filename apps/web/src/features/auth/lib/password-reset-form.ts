import { passwordSchema } from "@iib/domain";
import { z } from "zod";
import { AUTH_LOGIN_MESSAGES } from "@/features/auth/constants";

/** 재설정 메일 요청 폼 스키마. */
export const passwordResetRequestFormSchema = z.object({
  email: z.email({ message: AUTH_LOGIN_MESSAGES.emailInvalid }),
});

export type PasswordResetRequestFormValues = z.infer<typeof passwordResetRequestFormSchema>;

/** 새 비밀번호 폼 스키마 — passwordSchema(회원가입과 동일 정책) + 확인 일치 refine. */
export const newPasswordFormSchema = z
  .object({
    newPassword: passwordSchema,
    newPasswordConfirm: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["newPasswordConfirm"],
  });

export type NewPasswordFormValues = z.infer<typeof newPasswordFormSchema>;
