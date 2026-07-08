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
  if (!target) {
    return null;
  }

  const isOverLimit = target.reason.length > REJECT_REASON_MAX_LENGTH;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-md flex-col gap-3 rounded bg-white p-6 shadow-lg">
        <h2 className="text-base font-semibold">{REJECT_DIALOG_TITLE}</h2>
        <textarea
          value={target.reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={REJECT_REASON_PLACEHOLDER}
          rows={4}
          className="w-full rounded border p-2 text-sm"
        />
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{REJECT_DIALOG_HELPER_TEXT}</span>
          <span className={isOverLimit ? "text-red-600" : ""}>
            {target.reason.length} / {REJECT_REASON_MAX_LENGTH}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {REJECT_DIALOG_CANCEL_LABEL}
          </button>
          <button
            type="button"
            disabled={isSubmitting || isOverLimit}
            onClick={onConfirm}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {REJECT_DIALOG_CONFIRM_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
