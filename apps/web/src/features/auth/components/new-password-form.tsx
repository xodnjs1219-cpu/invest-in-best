"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { PASSWORD_POLICY_MESSAGE } from "@iib/domain";
import { Button, Heading, Input } from "@/components/ui";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";
import {
  newPasswordFormSchema,
  type NewPasswordFormValues,
} from "@/features/auth/lib/password-reset-form";

type NewPasswordFormProps = {
  onSubmit: (newPassword: string) => void;
  isPending: boolean;
  errorCode?: string;
};

/** 새 비밀번호 폼 Presenter — passwordSchema(회원가입과 동일 정책) + 확인 일치 검증. */
export function NewPasswordForm({ onSubmit, isPending, errorCode }: NewPasswordFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordFormSchema),
    defaultValues: { newPassword: "", newPasswordConfirm: "" },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values.newPassword))}
      noValidate
      className="flex flex-col gap-4"
    >
      <Heading level={1}>{AUTH_PASSWORD_RESET_MESSAGES.newPasswordTitle}</Heading>

      {errorCode && (
        <p role="alert" className="text-danger">
          {AUTH_PASSWORD_RESET_MESSAGES.temporaryError}
        </p>
      )}

      <p className="text-xs text-fg-muted">{PASSWORD_POLICY_MESSAGE}</p>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-password">{AUTH_PASSWORD_RESET_MESSAGES.newPasswordLabel}</label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.newPassword)}
          {...register("newPassword")}
        />
        {errors.newPassword && <p className="text-danger">{errors.newPassword.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-password-confirm">
          {AUTH_PASSWORD_RESET_MESSAGES.newPasswordConfirmLabel}
        </label>
        <Input
          id="new-password-confirm"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.newPasswordConfirm)}
          {...register("newPasswordConfirm")}
        />
        {errors.newPasswordConfirm && (
          <p className="text-danger">{errors.newPasswordConfirm.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending
          ? AUTH_PASSWORD_RESET_MESSAGES.newPasswordSubmittingLabel
          : AUTH_PASSWORD_RESET_MESSAGES.newPasswordSubmitLabel}
      </Button>
    </form>
  );
}
