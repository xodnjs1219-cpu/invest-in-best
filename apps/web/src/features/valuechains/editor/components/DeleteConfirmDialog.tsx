"use client";

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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div role="dialog" aria-modal="true" className="w-80 rounded-lg bg-white p-4 shadow-xl">
        <h2 className="text-sm font-semibold text-gray-900">노드를 삭제하시겠어요?</h2>
        <p className="mt-2 text-sm text-gray-600">
          노드 {nodeCount}개와 연결된 엣지 {connectedEdgeCount}개가 함께 삭제됩니다.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
