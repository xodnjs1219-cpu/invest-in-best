"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";
import { authErrorCodes } from "@/features/auth/backend/error";
import {
  passwordResetRequestFormSchema,
  type PasswordResetRequestFormValues,
} from "@/features/auth/lib/password-reset-form";

type PasswordResetRequestFormProps = {
  onSubmit: (email: string) => void;
  isPending: boolean;
  errorCode?: string;
};

const errorMessage = (errorCode?: string): string | undefined => {
  if (errorCode === authErrorCodes.passwordResetRateLimited) {
    return AUTH_PASSWORD_RESET_MESSAGES.rateLimited;
  }
  if (errorCode === authErrorCodes.passwordResetSendFailed) {
    return AUTH_PASSWORD_RESET_MESSAGES.temporaryError;
  }
  return undefined;
};

/** 재설정 메일 요청 폼 Presenter — 이메일 입력 1필드 + 제출. */
export function PasswordResetRequestForm({
  onSubmit,
  isPending,
  errorCode,
}: PasswordResetRequestFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetRequestFormValues>({
    resolver: zodResolver(passwordResetRequestFormSchema),
    defaultValues: { email: "" },
  });

  const message = errorMessage(errorCode);

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values.email))}
      noValidate
      className="flex flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">{AUTH_PASSWORD_RESET_MESSAGES.requestTitle}</h1>

      {message && (
        <p role="alert" className="text-red-600">
          {message}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="reset-request-email">{AUTH_PASSWORD_RESET_MESSAGES.requestEmailLabel}</label>
        <input id="reset-request-email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-red-600">{errors.email.message}</p>}
      </div>

      <button type="submit" disabled={isPending}>
        {isPending
          ? AUTH_PASSWORD_RESET_MESSAGES.requestSubmittingLabel
          : AUTH_PASSWORD_RESET_MESSAGES.requestSubmitLabel}
      </button>
    </form>
  );
}
