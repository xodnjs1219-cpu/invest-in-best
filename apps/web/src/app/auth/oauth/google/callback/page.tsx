"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <Suspense fallback={<p>로그인 처리 중...</p>}>
        <GoogleOAuthCallbackContent />
      </Suspense>
    </main>
  );
}
