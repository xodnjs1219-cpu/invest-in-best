"use client";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div role="alertdialog" aria-modal="true" className="w-96 rounded-lg bg-white p-4 shadow-xl">
        <h2 className="text-sm font-semibold text-gray-900">{ARCHIVE_DIALOG_TEXT.title}</h2>
        <p className="mt-2 text-sm text-gray-600">
          {`"${target.name}"`} {ARCHIVE_DIALOG_TEXT.description}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {ARCHIVE_DIALOG_TEXT.cancelLabel}
          </button>
          <button
            type="button"
            disabled={isArchiving}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {ARCHIVE_DIALOG_TEXT.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
