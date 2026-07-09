"use client";

import { useCallback, useState } from "react";
import {
  useChainEditorActions,
  useChainEditorState,
} from "@/features/valuechains/editor/context/ChainEditorContext";
import { selectConnectedEdgeIds } from "@/features/valuechains/editor/state/chainEditorSelectors";

/**
 * 단일 노드 삭제 흐름 훅 (UC-015 E7/BR-5) — 캔버스 ×버튼과 "현재 노드" 탭이 공유한다.
 * 연결된 엣지가 있으면 확인 다이얼로그를 띄우고(pendingDelete), 없으면 즉시 삭제한다.
 * 확인 시 노드와 그 연결 엣지를 함께 삭제한다.
 *
 * 반환값의 `dialogProps`를 DeleteConfirmDialog에 스프레드하면 확인 UI가 배선된다.
 */
export function useNodeDeletion() {
  const { state } = useChainEditorState();
  const { deleteElements } = useChainEditorActions();
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);

  /** 노드 삭제 요청 — 연결 엣지가 있으면 확인 다이얼로그, 없으면 즉시 삭제. */
  const requestDeleteNode = useCallback(
    (nodeId: string) => {
      const connectedEdgeIds = selectConnectedEdgeIds(state, [nodeId]);
      if (connectedEdgeIds.length > 0) {
        setPendingNodeId(nodeId);
        return;
      }
      deleteElements({ nodeIds: [nodeId], edgeIds: [] });
    },
    [state, deleteElements],
  );

  const confirmDelete = useCallback(() => {
    if (pendingNodeId === null) {
      return;
    }
    const edgeIds = selectConnectedEdgeIds(state, [pendingNodeId]);
    deleteElements({ nodeIds: [pendingNodeId], edgeIds });
    setPendingNodeId(null);
  }, [pendingNodeId, state, deleteElements]);

  const cancelDelete = useCallback(() => setPendingNodeId(null), []);

  const connectedEdgeCount =
    pendingNodeId !== null ? selectConnectedEdgeIds(state, [pendingNodeId]).length : 0;

  return {
    requestDeleteNode,
    /** DeleteConfirmDialog에 스프레드할 props. */
    dialogProps: {
      open: pendingNodeId !== null,
      nodeCount: pendingNodeId !== null ? 1 : 0,
      connectedEdgeCount,
      onConfirm: confirmDelete,
      onCancel: cancelDelete,
    },
  };
}
