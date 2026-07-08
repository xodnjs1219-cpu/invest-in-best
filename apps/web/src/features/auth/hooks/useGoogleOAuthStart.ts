"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { AUTH_OAUTH_MESSAGES } from "@/features/auth/constants";
import type { OAuthStartRequest, OAuthStartResponse } from "@/features/auth/backend/schema";

/**
 * 502/네트워크 오류를 이메일 로그인 대체 안내 문구로 매핑한다(spec Edge 4).
 * 현재는 모든 오류가 동일 대체 안내로 수렴하지만, 향후 코드별 세분화에 대비해 인자를 유지한다.
 */
export const googleOAuthStartErrorMessage = (): string => AUTH_OAUTH_MESSAGES.providerError;

/**
 * OAuth 시작 훅 — 인가 URL을 발급받아 전체 페이지 리다이렉트를 수행한다(spec 4단계).
 * `redirectPath`는 호출부(로그인 페이지)가 `?returnTo=` 쿼리에서 전달한다.
 */
export const useGoogleOAuthStart = () =>
  useMutation<OAuthStartResponse, ApiError, OAuthStartRequest["redirectPath"]>({
    mutationFn: (redirectPath) =>
      apiFetch<OAuthStartResponse>("/auth/oauth/google/start", {
        method: "POST",
        body: JSON.stringify({ redirectPath }),
      }),
    onSuccess: (response) => {
      window.location.assign(response.authorizationUrl);
    },
    retry: 0,
  });
