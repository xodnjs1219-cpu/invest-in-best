"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WithdrawNotice } from "@/features/account/components/withdraw-notice";
import { WithdrawConfirmDialog } from "@/features/account/components/withdraw-confirm-dialog";
import { ACCOUNT_MESSAGES } from "@/features/account/constants";
import { useWithdrawAccount } from "@/features/account/hooks/useWithdrawAccount";

type WithdrawStep = "notice" | "confirm";

const errorMessage = (errorCode?: string): string | undefined => {
  if (errorCode === "SOLE_ADMIN_WITHDRAWAL_BLOCKED") {
    return ACCOUNT_MESSAGES.soleAdminBlocked;
  }
  if (errorCode) {
    return ACCOUNT_MESSAGES.temporaryError;
  }
  return undefined;
};

/** 탈퇴 페이지 컨테이너 — 단계(notice → confirm) 진행 상태를 보유하고 훅에 로직을 위임한다. */
export function WithdrawFlow() {
  const router = useRouter();
  const [step, setStep] = useState<WithdrawStep>("notice");
  const { withdraw, isPending, isError, errorCode } = useWithdrawAccount();

  if (step === "notice") {
    return (
      <WithdrawNotice onCancel={() => router.replace("/account")} onProceed={() => setStep("confirm")} />
    );
  }

  return (
    <WithdrawConfirmDialog
      onConfirm={withdraw}
      onClose={() => setStep("notice")}
      isPending={isPending}
      errorMessage={isError ? errorMessage(errorCode) : undefined}
    />
  );
}
