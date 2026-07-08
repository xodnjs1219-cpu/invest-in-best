"use client";

import { SAVE_CONFLICT_DIALOG_TEXT } from "@/features/valuechains/editor/constants/save";

/**
 * 저장 충돌(E7) 다이얼로그(UC-018 plan 모듈 22) — 순수 Presenter.
 * `async.saveError?.kind==='conflict'`로 open을 파생하는 것은 호출측(ChainEditorPage) 책임.
 */
export interface SaveConflictDialogProps {
  open: boolean;
  onReload: () => void;
  onKeepEditing: () => void;
}

export function SaveConflictDialog({ open, onReload, onKeepEditing }: SaveConflictDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div role="dialog" aria-modal="true" className="w-96 rounded-lg bg-white p-4 shadow-xl">
        <h2 className="text-sm font-semibold text-gray-900">{SAVE_CONFLICT_DIALOG_TEXT.title}</h2>
        <p className="mt-2 text-sm text-gray-600">{SAVE_CONFLICT_DIALOG_TEXT.description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onKeepEditing}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {SAVE_CONFLICT_DIALOG_TEXT.keepEditingLabel}
          </button>
          <button
            type="button"
            onClick={onReload}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            {SAVE_CONFLICT_DIALOG_TEXT.reloadLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
