"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/http/api-client";
import { useCurrentUser } from "@/features/auth/context/current-user-provider";
import { clearClientAuthState } from "@/features/auth/lib/clear-client-auth-state";
import { createBrowserClient } from "@/lib/supabase/browser-client";
import { WITHDRAW_REDIRECT_PATH } from "@/features/account/constants";
import type { WithdrawAccountResponse } from "@/features/account/backend/schema";

const UNAUTHORIZED_CODE = "UNAUTHORIZED";

/**
 * 회원 탈퇴 mutation 훅 — 성공/401(멱등 완료 처리) 시 클라이언트 정리 후 메인 이동.
 * 409(유일 Admin)·500/네트워크 오류는 인증 상태를 유지하고 재시도를 허용한다.
 */
export const useWithdrawAccount = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clearUser } = useCurrentUser();
  const inFlightRef = useRef(false);

  const mutation = useMutation<WithdrawAccountResponse, ApiError, void>({
    mutationFn: () => apiFetch<WithdrawAccountResponse>("/account", { method: "DELETE" }),
    retry: 0,
    onSettled: async (_data, error) => {
      inFlightRef.current = false;
      const isUnauthorized = error instanceof ApiError && error.code === UNAUTHORIZED_CODE;
      if (!error || isUnauthorized) {
        await clearClientAuthState({
          browserClient: createBrowserClient(),
          clearUser,
          queryClient,
        });
        router.replace(WITHDRAW_REDIRECT_PATH);
      }
    },
  });

  return {
    withdraw: () => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      mutation.mutate();
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    errorCode: mutation.error?.code,
  };
};
