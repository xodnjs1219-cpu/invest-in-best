"use client";

import { Button, Card, Heading } from "@/components/ui";
import { ARCHIVE_DIALOG_TEXT } from "@/features/admin-valuechains/constants";

export interface ArchiveChainTarget {
  chainId: string;
  name: string;
}

export interface ArchiveChainDialogProps {
  target: ArchiveChainTarget | null;
  isArchiving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 공식 체인 보관 확인 다이얼로그(UC-021 plan 모듈 M15) — 순수 Presenter.
 * 진행 중(isArchiving)에는 dismiss(취소)를 차단한다.
 */
export function ArchiveChainDialog({ target, isArchiving, onConfirm, onCancel }: ArchiveChainDialogProps) {
  if (!target) {
    return null;
  }

  const handleCancel = () => {
    if (isArchiving) {
      return;
    }
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card role="alertdialog" aria-modal="true" className="w-full max-w-sm bg-surface-raised p-6">
        <Heading level={3}>{ARCHIVE_DIALOG_TEXT.title}</Heading>
        <p className="mt-2 text-sm text-fg-muted">
          {`"${target.name}"`} {ARCHIVE_DIALOG_TEXT.description}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            {ARCHIVE_DIALOG_TEXT.cancelLabel}
          </Button>
          <Button variant="danger" size="sm" disabled={isArchiving} onClick={onConfirm}>
            {ARCHIVE_DIALOG_TEXT.confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
