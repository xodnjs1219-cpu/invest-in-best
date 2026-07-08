"use client";

import { PasswordResetRequestForm } from "@/features/auth/components/password-reset-request-form";
import { ResetEmailSentNotice } from "@/features/auth/components/reset-email-sent-notice";
import { NewPasswordForm } from "@/features/auth/components/new-password-form";
import { ResetTokenInvalidNotice } from "@/features/auth/components/reset-token-invalid-notice";
import { ResetSuccessNotice } from "@/features/auth/components/reset-success-notice";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";
import { usePasswordResetFlow } from "@/features/auth/hooks/usePasswordResetFlow";

type PasswordResetFlowProps = {
  tokenHash: string | null;
};

/** 단계 컨테이너 — usePasswordResetFlow(state machine)와 Presenter를 결선한다. */
export function PasswordResetFlow({ tokenHash }: PasswordResetFlowProps) {
  const { step, errorCode, isPending, actions } = usePasswordResetFlow(tokenHash);

  switch (step) {
    case "verifying":
      return <p>{AUTH_PASSWORD_RESET_MESSAGES.verifying}</p>;
    case "sent":
      return <ResetEmailSentNotice onBack={actions.backToRequest} />;
    case "newPassword":
      return (
        <NewPasswordForm
          onSubmit={actions.submitNewPassword}
          isPending={isPending}
          errorCode={errorCode}
        />
      );
    case "invalid":
      return <ResetTokenInvalidNotice onRequestAgain={actions.backToRequest} />;
    case "done":
      return <ResetSuccessNotice />;
    case "request":
    default:
      return (
        <PasswordResetRequestForm
          onSubmit={actions.submitEmail}
          isPending={isPending}
          errorCode={errorCode}
        />
      );
  }
}
