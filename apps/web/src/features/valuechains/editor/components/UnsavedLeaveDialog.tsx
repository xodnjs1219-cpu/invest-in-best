/**
 * 미저장 이탈 경고 다이얼로그 (UC-013 plan 모듈 22, E4).
 * shadcn-ui 미설치 상태이므로 순수 HTML + Tailwind + ARIA 속성으로 구현한다.
 * 순수 Presenter — #12 `useUnsavedChangesGuard` 훅의 반환값을 호출측(ChainEditorPage)이 연결한다.
 */
export interface UnsavedLeaveDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsavedLeaveDialog({ open, onConfirm, onCancel }: UnsavedLeaveDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-leave-dialog-title"
        aria-describedby="unsaved-leave-dialog-description"
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id="unsaved-leave-dialog-title" className="text-base font-semibold text-gray-900">
          저장하지 않은 변경 사항이 있습니다
        </h2>
        <p id="unsaved-leave-dialog-description" className="mt-2 text-sm text-gray-600">
          나가면 편집 내용이 사라집니다.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            계속 편집
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}
