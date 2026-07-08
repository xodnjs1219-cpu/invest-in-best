"use client";

import { GoogleLoginButton } from "@/features/auth/components/google-login-button";
import { googleOAuthStartErrorMessage, useGoogleOAuthStart } from "@/features/auth/hooks/useGoogleOAuthStart";

type GoogleLoginSectionProps = {
  redirectPath?: string;
};

/** GoogleLoginButton과 useGoogleOAuthStart를 결선하는 조립부(Container). */
export function GoogleLoginSection({ redirectPath }: GoogleLoginSectionProps) {
  const startMutation = useGoogleOAuthStart();

  return (
    <GoogleLoginButton
      onClick={() => startMutation.mutate(redirectPath)}
      isPending={startMutation.isPending}
      errorMessage={startMutation.isError ? googleOAuthStartErrorMessage() : undefined}
    />
  );
}
