"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/ui";
import { OAuthCallbackView } from "@/features/auth/components/oauth-callback-view";
import { useGoogleOAuthCallback } from "@/features/auth/hooks/useGoogleOAuthCallback";

function GoogleOAuthCallbackContent() {
  const params = useSearchParams();
  const state = useGoogleOAuthCallback(params);

  return <OAuthCallbackView phase={state.phase} errorCode={state.errorCode} />;
}

/** `/auth/oauth/google/callback` — Supabase Auth가 리다이렉트하는 FE 진입점(라우팅/조립만). */
export default function GoogleOAuthCallbackPage() {
  return (
    <PageShell width="sm">
      <Suspense fallback={<p>로그인 처리 중...</p>}>
        <GoogleOAuthCallbackContent />
      </Suspense>
    </PageShell>
  );
}
