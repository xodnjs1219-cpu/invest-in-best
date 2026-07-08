"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { AUTH_SIGNUP_MESSAGES } from "@/features/auth/constants";
import { authErrorCodes } from "@/features/auth/backend/error";
import type { SignupRequest, SignupResponse } from "@/features/auth/backend/schema";

/** 오류 코드 → 사용자 문구 매핑. */
export const signupErrorMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) {
    return AUTH_SIGNUP_MESSAGES.genericError;
  }

  switch (error.code) {
    case authErrorCodes.rateLimited:
      return AUTH_SIGNUP_MESSAGES.rateLimited;
    case authErrorCodes.signupFailed:
    case authErrorCodes.termsSaveFailed:
      return AUTH_SIGNUP_MESSAGES.temporaryError;
    default:
      return AUTH_SIGNUP_MESSAGES.genericError;
  }
};

/**
 * 가입 뮤테이션 훅 — 재시도 없음(비멱등 UX 정책, 인증 메일 중복 발송 방지).
 * E6(네트워크/서버 오류)은 사용자 수동 재시도로 처리한다.
 */
export const useSignup = () =>
  useMutation<SignupResponse, ApiError, SignupRequest>({
    mutationFn: (body) =>
      apiFetch<SignupResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    retry: 0,
  });
