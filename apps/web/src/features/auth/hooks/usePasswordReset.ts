"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import type {
  ConfirmPasswordResetRequest,
  ConfirmPasswordResetResponse,
  PasswordResetRequestRequest,
  PasswordResetRequestResponse,
  VerifyResetTokenRequest,
  VerifyResetTokenResponse,
} from "@/features/auth/backend/schema";

/** 재설정 메일 발송 요청 mutation — 재시도 없음(중복 메일 발송 방지). */
export const usePasswordResetRequest = () =>
  useMutation<PasswordResetRequestResponse, ApiError, PasswordResetRequestRequest>({
    mutationFn: (body) =>
      apiFetch<PasswordResetRequestResponse>("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    retry: 0,
  });

/** 재설정 토큰 검증 mutation — 일회성 토큰 소모와 충돌하므로 재시도 없음. */
export const useResetTokenVerify = () =>
  useMutation<VerifyResetTokenResponse, ApiError, VerifyResetTokenRequest>({
    mutationFn: (body) =>
      apiFetch<VerifyResetTokenResponse>("/auth/password-reset/verify", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    retry: 0,
  });

/** 새 비밀번호 확정 mutation — 재시도 없음. */
export const usePasswordResetConfirm = () =>
  useMutation<ConfirmPasswordResetResponse, ApiError, ConfirmPasswordResetRequest>({
    mutationFn: (body) =>
      apiFetch<ConfirmPasswordResetResponse>("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    retry: 0,
  });
