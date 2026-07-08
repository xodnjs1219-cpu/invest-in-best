import Link from "next/link";
import { AUTH_OAUTH_MESSAGES } from "@/features/auth/constants";
import { authErrorCodes } from "@/features/auth/backend/error";
import type { OAuthCallbackPhase } from "@/features/auth/hooks/useGoogleOAuthCallback";

type OAuthCallbackViewProps = {
  phase: OAuthCallbackPhase;
  errorCode?: string;
};

const ERROR_VIEW_MAP: Record<string, { message: string; href: string; label: string }> = {
  [authErrorCodes.oauthExchangeFailed]: {
    message: `인증이 거부되었습니다. ${AUTH_OAUTH_MESSAGES.exchangeFailed}`,
    href: "/auth/login",
    label: AUTH_OAUTH_MESSAGES.retryGoogleLogin,
  },
  [authErrorCodes.oauthEmailUnverified]: {
    message: AUTH_OAUTH_MESSAGES.emailUnverified,
    href: "/auth/signup",
    label: AUTH_OAUTH_MESSAGES.goToEmailSignup,
  },
  [authErrorCodes.oauthProviderError]: {
    message: AUTH_OAUTH_MESSAGES.providerError,
    href: "/auth/login",
    label: AUTH_OAUTH_MESSAGES.goToEmailLogin,
  },
};

const DEFAULT_ERROR_VIEW = {
  message: AUTH_OAUTH_MESSAGES.genericError,
  href: "/auth/login",
  label: AUTH_OAUTH_MESSAGES.goToEmailLogin,
};

/** OAuth 콜백 처리 상태를 안내하는 Presenter — useGoogleOAuthCallback의 phase/errorCode를 소비한다. */
export function OAuthCallbackView({ phase, errorCode }: OAuthCallbackViewProps) {
  if (phase === "processing") {
    return (
      <div className="flex flex-col items-center gap-2">
        <p>{AUTH_OAUTH_MESSAGES.processing}</p>
      </div>
    );
  }

  const view = (errorCode && ERROR_VIEW_MAP[errorCode]) || DEFAULT_ERROR_VIEW;

  return (
    <div className="flex flex-col gap-4">
      <p>{view.message}</p>
      <Link href={view.href} className="underline">
        {view.label}
      </Link>
    </div>
  );
}
