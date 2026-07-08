"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { AUTH_LOGIN_MESSAGES } from "@/features/auth/constants";
import { authErrorCodes } from "@/features/auth/backend/error";
import type { LoginRequest, LoginResponse } from "@/features/auth/backend/schema";

/** 오류 코드 → 사용자 문구 매핑. */
export const loginErrorMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) {
    return AUTH_LOGIN_MESSAGES.genericError;
  }

  switch (error.code) {
    case authErrorCodes.invalidCredentials:
      return AUTH_LOGIN_MESSAGES.invalidCredentials;
    case authErrorCodes.emailNotConfirmed:
      return AUTH_LOGIN_MESSAGES.emailNotConfirmed;
    case authErrorCodes.rateLimited:
      return AUTH_LOGIN_MESSAGES.rateLimited;
    case authErrorCodes.profileNotFound:
    case authErrorCodes.serviceError:
    case authErrorCodes.validationError:
      return AUTH_LOGIN_MESSAGES.temporaryError;
    default:
      return AUTH_LOGIN_MESSAGES.genericError;
  }
};

/**
 * 로그인 뮤테이션 훅 — 재시도 없음(레이트 리밋 악화 방지, 사용자 트리거 재시도만).
 * 세션은 Set-Cookie로 확립되며(bodyless), 성공 시 호출부가 CurrentUserProvider를 갱신한다.
 */
export const useLogin = () =>
  useMutation<LoginResponse, ApiError, LoginRequest>({
    mutationFn: (body) =>
      apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    retry: 0,
  });
