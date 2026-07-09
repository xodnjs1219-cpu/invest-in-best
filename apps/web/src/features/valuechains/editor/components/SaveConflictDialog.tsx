"use client";

import { SAVE_CONFLICT_DIALOG_TEXT } from "@/features/valuechains/editor/constants/save";
import { Button, Card, Heading } from "@/components/ui";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card role="dialog" aria-modal="true" className="w-full max-w-sm bg-surface-raised p-6">
        <Heading level={3}>{SAVE_CONFLICT_DIALOG_TEXT.title}</Heading>
        <p className="mt-2 text-sm text-fg-muted">{SAVE_CONFLICT_DIALOG_TEXT.description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onKeepEditing}>
            {SAVE_CONFLICT_DIALOG_TEXT.keepEditingLabel}
          </Button>
          <Button type="button" size="sm" onClick={onReload}>
            {SAVE_CONFLICT_DIALOG_TEXT.reloadLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
