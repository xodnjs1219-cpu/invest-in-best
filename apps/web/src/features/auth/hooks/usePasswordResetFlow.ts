"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/http/api-client";
import {
  usePasswordResetConfirm,
  usePasswordResetRequest,
  useResetTokenVerify,
} from "@/features/auth/hooks/usePasswordReset";

export type PasswordResetStep =
  | "request"
  | "sent"
  | "verifying"
  | "newPassword"
  | "done"
  | "invalid";

export type PasswordResetFlowState = {
  step: PasswordResetStep;
  errorCode?: string;
  isPending: boolean;
  actions: {
    submitEmail: (email: string) => Promise<void>;
    submitNewPassword: (newPassword: string) => Promise<void>;
    backToRequest: () => void;
  };
};

/**
 * 비밀번호 재설정 페이지의 단계 상태 머신(Container 로직).
 * `tokenHash` 존재 시 verify를 자동 1회 실행한다(StrictMode 재실행 가드 포함).
 */
export const usePasswordResetFlow = (tokenHash: string | null): PasswordResetFlowState => {
  const [step, setStep] = useState<PasswordResetStep>(tokenHash ? "verifying" : "request");
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const verifyRequestedRef = useRef(false);

  const requestMutation = usePasswordResetRequest();
  const verifyMutation = useResetTokenVerify();
  const confirmMutation = usePasswordResetConfirm();

  useEffect(() => {
    if (!tokenHash || verifyRequestedRef.current) {
      return;
    }
    verifyRequestedRef.current = true;

    verifyMutation.mutate(
      { tokenHash },
      {
        onSuccess: () => setStep("newPassword"),
        onError: () => setStep("invalid"),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref 가드로 1회만 실행
  }, [tokenHash]);

  const submitEmail = async (email: string): Promise<void> => {
    setErrorCode(undefined);
    try {
      await requestMutation.mutateAsync({ email });
      setStep("sent");
    } catch (err) {
      // 오류는 상태(errorCode)로 흡수한다 — 호출부(Presenter)는 예외를 처리하지 않는다.
      if (err instanceof ApiError) {
        setErrorCode(err.code);
      }
    }
  };

  const submitNewPassword = async (newPassword: string): Promise<void> => {
    setErrorCode(undefined);
    try {
      await confirmMutation.mutateAsync({ newPassword });
      setStep("done");
    } catch (err) {
      // 오류는 상태(step/errorCode)로 흡수한다 — 호출부(Presenter)는 예외를 처리하지 않는다.
      if (err instanceof ApiError && err.status === 401) {
        setStep("invalid");
      } else if (err instanceof ApiError) {
        setErrorCode(err.code);
      }
    }
  };

  const backToRequest = () => {
    setErrorCode(undefined);
    setStep("request");
  };

  return {
    step,
    errorCode,
    isPending: requestMutation.isPending || verifyMutation.isPending || confirmMutation.isPending,
    actions: { submitEmail, submitNewPassword, backToRequest },
  };
};
