import {
  CANCEL_BUTTON_LABEL,
  DEACTIVATE_COMMON_NOTICE,
  DEACTIVATE_CONFIRM_BUTTON_LABEL,
  DEACTIVATE_DIALOG_TITLE,
  DEACTIVATE_IN_USE_NOTICE,
} from "@/features/admin-relation-types/constants";

export type DeactivateConfirmDialogTarget = { id: string; name: string; isInUse: boolean };

export type DeactivateConfirmDialogProps = {
  target: DeactivateConfirmDialogTarget | null;
  isSubmitting: boolean;
  onConfirm: (id: string) => void;
  onCancel: () => void;
};

/**
 * 순수 Presenter — 비활성화 확인 다이얼로그(plan M13, spec Main-5-1·E3·BR-2).
 * `target=null`이면 렌더하지 않는다. 사용 중(isInUse)이면 강조 안내를 추가로 표시한다.
 */
export function DeactivateConfirmDialog({
  target,
  isSubmitting,
  onConfirm,
  onCancel,
}: DeactivateConfirmDialogProps) {
  if (!target) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={DEACTIVATE_DIALOG_TITLE}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{DEACTIVATE_DIALOG_TITLE}</h2>
        <p className="mb-2 text-sm text-gray-700">
          <strong>{target.name}</strong>
        </p>
        <p className="mb-2 text-sm text-gray-600">{DEACTIVATE_COMMON_NOTICE}</p>
        {target.isInUse && (
          <p className="mb-4 rounded bg-amber-50 p-2 text-sm text-amber-800">
            {DEACTIVATE_IN_USE_NOTICE}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {CANCEL_BUTTON_LABEL}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(target.id)}
            disabled={isSubmitting}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {DEACTIVATE_CONFIRM_BUTTON_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
