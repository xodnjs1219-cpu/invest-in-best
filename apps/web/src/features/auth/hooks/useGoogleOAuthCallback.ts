"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { sanitizeReturnTo } from "@/lib/utils/safe-redirect";
import { useCurrentUser } from "@/features/auth/context/current-user-provider";
import type { OAuthCallbackResponse } from "@/features/auth/backend/schema";

export type OAuthCallbackPhase = "processing" | "error";

export type OAuthCallbackState = {
  phase: OAuthCallbackPhase;
  errorCode?: string;
};

/**
 * OAuth 콜백 훅 — 쿼리(code/error/next)를 해석해 세션 확립 API를 1회 호출한다.
 * `error` 존재(취소/거부)는 BE 호출 없이 로그인 페이지로 즉시 복귀한다(spec Edge 1).
 */
export const useGoogleOAuthCallback = (params: URLSearchParams): OAuthCallbackState => {
  const router = useRouter();
  const { setUser } = useCurrentUser();
  const [state, setState] = useState<OAuthCallbackState>({ phase: "processing" });
  const requestedRef = useRef(false);

  const code = params.get("code");
  const error = params.get("error");
  const next = params.get("next");

  useEffect(() => {
    if (error) {
      router.replace("/auth/login?notice=oauth_cancelled");
      return;
    }

    if (!code) {
      router.replace("/auth/login");
      return;
    }

    if (requestedRef.current) {
      return;
    }
    requestedRef.current = true;

    const redirectPath = sanitizeReturnTo(next);

    apiFetch<OAuthCallbackResponse>("/auth/oauth/google/callback", {
      method: "POST",
      body: JSON.stringify({ code, redirectPath }),
    })
      .then((response) => {
        setUser(response.user);
        router.replace(sanitizeReturnTo(response.redirectPath));
      })
      .catch((err: unknown) => {
        setState(
          err instanceof ApiError
            ? { phase: "error", errorCode: err.code }
            : { phase: "error" },
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestedRef 가드로 1회만 실행
  }, [code, error, next]);

  return state;
};
