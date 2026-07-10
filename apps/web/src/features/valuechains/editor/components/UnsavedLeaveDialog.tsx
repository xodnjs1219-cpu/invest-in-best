import { Button, Card, Heading } from "@/components/ui";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <Card
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-leave-dialog-title"
        aria-describedby="unsaved-leave-dialog-description"
        className="w-full max-w-sm bg-surface-raised p-6"
      >
        <Heading level={3} id="unsaved-leave-dialog-title">
          저장하지 않은 변경 사항이 있습니다
        </Heading>
        <p id="unsaved-leave-dialog-description" className="mt-2 text-sm text-fg-muted">
          나가면 편집 내용이 사라집니다.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            계속 편집
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onConfirm}>
            나가기
          </Button>
        </div>
      </Card>
    </div>
  );
}
