"use client";

import { Button, Card, Heading, useDialogA11y } from "@/components/ui";
import {
  buildDeleteConfirmDescription,
  DELETE_CANCEL_LABEL,
  DELETE_CONFIRM_ACTION_LABEL,
  DELETE_CONFIRM_TITLE,
  DELETE_PENDING_LABEL,
} from "@/features/valuechains/constants/delete";

export type DeleteChainConfirmDialogProps = {
  open: boolean;
  chainName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 삭제 확인 다이얼로그 Presenter (UC-019 plan 모듈 8) — shadcn-ui 미설치 환경이므로
 * 순수 HTML + Tailwind로 구현한다. 되돌릴 수 없음·종속 데이터 삭제 안내(BR-7, Main 2) +
 * [삭제]/[취소] 액션. 진행 중(`isDeleting`)에는 양쪽 버튼을 비활성화해 이탈/중복 확정을 막는다.
 */
export function DeleteChainConfirmDialog({
  open,
  chainName,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteChainConfirmDialogProps) {
  // 진행 중에는 Escape로도 닫히지 않는다(중복 확정·이탈 방지 — 버튼 disabled와 동일 규칙).
  const dialogRef = useDialogA11y(open, () => {
    if (!isDeleting) onCancel();
  });

  if (!open) {
    return null;
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-chain-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
    >
      <Card className="panel-enter w-full max-w-sm p-5 shadow-deep">
        <Heading level={3} id="delete-chain-dialog-title">
          {DELETE_CONFIRM_TITLE}
        </Heading>
        <p className="mt-2 text-sm text-fg-muted">{buildDeleteConfirmDescription(chainName)}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isDeleting}>
            {DELETE_CANCEL_LABEL}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? DELETE_PENDING_LABEL : DELETE_CONFIRM_ACTION_LABEL}
          </Button>
        </div>
      </Card>
    </div>
  );
}
