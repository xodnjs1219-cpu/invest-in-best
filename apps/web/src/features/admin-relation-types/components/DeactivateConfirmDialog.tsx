import { Button, Card, Heading } from "@/components/ui";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
    >
      <Card className="w-full max-w-sm bg-surface-raised p-6">
        <Heading level={2} className="mb-4">{DEACTIVATE_DIALOG_TITLE}</Heading>
        <p className="mb-2 text-sm text-fg-muted">
          <strong>{target.name}</strong>
        </p>
        <p className="mb-2 text-sm text-fg-muted">{DEACTIVATE_COMMON_NOTICE}</p>
        {target.isInUse && (
          <p className="mb-4 rounded-[var(--radius)] bg-warning-soft p-2 text-sm text-warning">
            {DEACTIVATE_IN_USE_NOTICE}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSubmitting}>
            {CANCEL_BUTTON_LABEL}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onConfirm(target.id)}
            disabled={isSubmitting}
          >
            {DEACTIVATE_CONFIRM_BUTTON_LABEL}
          </Button>
        </div>
      </Card>
    </div>
  );
}
