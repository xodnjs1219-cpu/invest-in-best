"use client";

import { useState } from "react";
import { Button, Card, Heading, Input } from "@/components/ui";
import { ACCOUNT_MESSAGES, WITHDRAW_CONFIRM_PHRASE } from "@/features/account/constants";

type WithdrawConfirmDialogProps = {
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
  errorMessage?: string;
};

/**
 * 2단계 확인 Presenter — A-14 확정안: 확인 문구 입력 방식(재인증 비밀번호 없음).
 * 입력값이 `WITHDRAW_CONFIRM_PHRASE`와 정확히 일치할 때만 확인 버튼이 활성화된다.
 */
export function WithdrawConfirmDialog({
  onConfirm,
  onClose,
  isPending,
  errorMessage,
}: WithdrawConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const isMatched = inputValue === WITHDRAW_CONFIRM_PHRASE;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <Heading level={2}>{ACCOUNT_MESSAGES.confirmDialogTitle}</Heading>

      {errorMessage && (
        <p role="alert" className="text-danger">
          {errorMessage}
        </p>
      )}

      <label htmlFor="withdraw-confirm-input">{ACCOUNT_MESSAGES.confirmInputLabel}</label>
      <Input
        id="withdraw-confirm-input"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          {ACCOUNT_MESSAGES.closeLabel}
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm} disabled={!isMatched || isPending}>
          {isPending ? ACCOUNT_MESSAGES.confirmSubmittingLabel : ACCOUNT_MESSAGES.confirmSubmitLabel}
        </Button>
      </div>
    </Card>
  );
}
