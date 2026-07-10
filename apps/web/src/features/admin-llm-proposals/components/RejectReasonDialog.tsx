"use client";

import { Button, Card, Heading, Textarea, useDialogA11y } from "@/components/ui";
import {
  REJECT_DIALOG_CANCEL_LABEL,
  REJECT_DIALOG_CONFIRM_LABEL,
  REJECT_DIALOG_HELPER_TEXT,
  REJECT_DIALOG_TITLE,
  REJECT_REASON_MAX_LENGTH,
  REJECT_REASON_PLACEHOLDER,
} from "@/features/admin-llm-proposals/constants";
import type { RejectTarget } from "@/features/admin-llm-proposals/hooks/adminLlmQueueReducer";

type RejectReasonDialogProps = {
  target: RejectTarget | null;
  isSubmitting: boolean;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** 순수 Presenter — 거부 사유 입력 다이얼로그(최소 모달, target=null이면 미렌더). */
export function RejectReasonDialog({
  target,
  isSubmitting,
  onReasonChange,
  onCancel,
  onConfirm,
}: RejectReasonDialogProps) {
  // 제출 중에는 Escape로도 닫히지 않는다(중복 전송 방지).
  const dialogRef = useDialogA11y(Boolean(target), () => {
    if (!isSubmitting) onCancel();
  });

  if (!target) {
    return null;
  }

  const isOverLimit = target.reason.length > REJECT_REASON_MAX_LENGTH;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <Card
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-reason-dialog-title"
        className="panel-enter flex w-full max-w-md flex-col gap-3 bg-surface-raised p-6"
      >
        <Heading level={2} id="reject-reason-dialog-title">
          {REJECT_DIALOG_TITLE}
        </Heading>
        <Textarea
          value={target.reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={REJECT_REASON_PLACEHOLDER}
          rows={4}
        />
        <div className="flex items-center justify-between text-xs text-fg-muted">
          <span>{REJECT_DIALOG_HELPER_TEXT}</span>
          <span className={isOverLimit ? "text-danger" : ""}>
            {target.reason.length} / {REJECT_REASON_MAX_LENGTH}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={isSubmitting} onClick={onCancel}>
            {REJECT_DIALOG_CANCEL_LABEL}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={isSubmitting || isOverLimit}
            onClick={onConfirm}
          >
            {REJECT_DIALOG_CONFIRM_LABEL}
          </Button>
        </div>
      </Card>
    </div>
  );
}
