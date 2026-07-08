"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { authErrorCodes } from "@/features/auth/backend/error";
import { useCurrentUser } from "@/features/auth/context/current-user-provider";
import { clearClientAuthState } from "@/features/auth/lib/clear-client-auth-state";
import { createBrowserClient } from "@/lib/supabase/browser-client";
import type { LogoutResponse } from "@/features/auth/backend/schema";

export type LogoutOutcome = "clear-and-go" | "stay-and-retry";

/**
 * 로그아웃 결과 → 후속 동작 판정 순수 함수.
 * 성공(undefined) 또는 서버 500(AUTH_LOGOUT_FAILED, A-12 베스트 에포트)은 클라이언트 정리 후 이동.
 * 네트워크 오류는 로컬 상태를 유지하고 재시도를 유도한다(Edge 4 — 서버 멱등이므로 재클릭 안전).
 */
export const resolveLogoutOutcome = (error: unknown): LogoutOutcome => {
  if (error === undefined) {
    return "clear-and-go";
  }
  if (error instanceof ApiError && error.code === authErrorCodes.logoutFailed) {
    return "clear-and-go";
  }
  return "stay-and-retry";
};

/**
 * 로그아웃 mutation 훅 — API 호출 → 결과 판정(resolveLogoutOutcome) → 클라이언트 정리 + 메인 이동.
 */
export const useLogout = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clearUser } = useCurrentUser();

  const mutation = useMutation<LogoutResponse, ApiError, void>({
    mutationFn: () => apiFetch<LogoutResponse>("/auth/logout", { method: "POST" }),
    retry: 0,
    onSettled: async (_data, error) => {
      const outcome = resolveLogoutOutcome(error ?? undefined);
      if (outcome === "clear-and-go") {
        await clearClientAuthState({
          browserClient: createBrowserClient(),
          clearUser,
          queryClient,
        });
        router.replace("/");
      }
    },
  });

  return {
    logout: () => mutation.mutate(),
    isPending: mutation.isPending,
    isError: mutation.isError,
  };
};
