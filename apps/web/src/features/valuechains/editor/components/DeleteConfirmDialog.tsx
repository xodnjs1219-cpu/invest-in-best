"use client";

import { Button, Card, Heading, useDialogA11y } from "@/components/ui";

/**
 * 노드 삭제 확인 다이얼로그(UC-015 plan 모듈 21, E7/BR-5) — 순수 Presenter, 로직 없음.
 * 연결 엣지가 있는 노드 삭제 시에만 호출측이 open=true로 표시한다.
 */
export interface DeleteConfirmDialogProps {
  open: boolean;
  nodeCount: number;
  connectedEdgeCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  open,
  nodeCount,
  connectedEdgeCount,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const dialogRef = useDialogA11y(open, onCancel);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <Card
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-node-dialog-title"
        className="panel-enter w-full max-w-sm bg-surface-raised p-6"
      >
        <Heading level={3} id="delete-node-dialog-title">
          노드를 삭제하시겠습니까?
        </Heading>
        <p className="mt-2 text-sm text-fg-muted">
          노드 {nodeCount}개와 연결된 엣지 {connectedEdgeCount}개가 함께 삭제됩니다.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            취소
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onConfirm}>
            삭제
          </Button>
        </div>
      </Card>
    </div>
  );
}
