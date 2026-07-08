"use client";

import { useState } from "react";
import type { EdgeBlockReason } from "@iib/domain";
import { ChainCanvas } from "@/components/mindmap/ChainCanvas";
import {
  selectConnectedEdgeIds,
  selectReactFlowEdges,
  selectReactFlowNodes,
} from "@/features/valuechains/editor/state/chainEditorSelectors";
import {
  useChainEditorActions,
  useChainEditorState,
} from "@/features/valuechains/editor/context/ChainEditorContext";
import { RelationTypePicker } from "@/features/valuechains/editor/components/RelationTypePicker";
import { DeleteConfirmDialog } from "@/features/valuechains/editor/components/DeleteConfirmDialog";

const EDGE_BLOCK_MESSAGES: Record<EdgeBlockReason, string> = {
  NODE_NOT_FOUND: "노드를 찾을 수 없습니다.",
  SELF_REFERENCE: "동일 노드끼리는 연결할 수 없습니다.",
  RELATION_TYPE_INACTIVE: "선택할 수 없는 관계 종류입니다.",
  DUPLICATE_RELATION: "동일한 관계가 이미 존재합니다.",
};

type PendingConnection = { source: string; target: string };
type EditingEdge = { clientEdgeId: string; relationTypeId: string };

/**
 * 편집 캔버스 컨테이너(UC-015/016 plan 모듈 M21) — Context 상태를 읽어 `ChainCanvas`(순수 프레젠터)에
 * React Flow 데이터를 배선하고, 연결 제스처(pending → RelationTypePicker) 및 삭제(확인 다이얼로그) 흐름을
 * 처리한다. 로직-표시 분리: 도메인 판정은 Context 액션(`addEdge` 등)에 위임한다.
 */
export function EditorCanvasContainer() {
  const { state, computed } = useChainEditorState();
  const { addEdge, changeEdgeRelation, deleteElements } = useChainEditorActions();

  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [editingEdge, setEditingEdge] = useState<EditingEdge | null>(null);
  const [blockedReason, setBlockedReason] = useState<EdgeBlockReason | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ nodeIds: string[]; edgeIds: string[] } | null>(null);

  const reactFlowNodes = selectReactFlowNodes(state);
  const reactFlowEdges = selectReactFlowEdges(state, computed.relationTypeById, { edgeIds: [] });

  const handleConnect = (params: { source: string; target: string }) => {
    setBlockedReason(null);
    setPendingConnection(params);
  };

  const handleSelectRelationType = (relationTypeId: string) => {
    if (pendingConnection) {
      const result = addEdge({
        sourceClientNodeId: pendingConnection.source,
        targetClientNodeId: pendingConnection.target,
        relationTypeId,
      });
      if (!result.ok) {
        setBlockedReason(result.reason);
      } else {
        setPendingConnection(null);
      }
      return;
    }
    if (editingEdge) {
      const result = changeEdgeRelation(editingEdge.clientEdgeId, relationTypeId);
      if (!result.ok) {
        setBlockedReason(result.reason);
      } else {
        setEditingEdge(null);
      }
    }
  };

  const handleCancelPicker = () => {
    setPendingConnection(null);
    setEditingEdge(null);
    setBlockedReason(null);
  };

  const handleElementsDelete = (target: { nodeIds: string[]; edgeIds: string[] }) => {
    const connectedEdgeIds = selectConnectedEdgeIds(state, target.nodeIds);
    if (connectedEdgeIds.length > 0) {
      setPendingDelete(target);
      return;
    }
    deleteElements(target);
  };

  const handleConfirmDelete = () => {
    if (pendingDelete) {
      const connectedEdgeIds = selectConnectedEdgeIds(state, pendingDelete.nodeIds);
      const edgeIds = [...new Set([...pendingDelete.edgeIds, ...connectedEdgeIds])];
      deleteElements({ nodeIds: pendingDelete.nodeIds, edgeIds });
      setPendingDelete(null);
    }
  };

  const isPickerOpen = pendingConnection !== null || editingEdge !== null;

  return (
    <div className="relative">
      <ChainCanvas
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onConnect={handleConnect}
        onElementsDelete={handleElementsDelete}
        onNodeDragStop={() => undefined}
        nodesConnectable={computed.hasActiveRelationTypes}
      />

      {blockedReason && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
          {EDGE_BLOCK_MESSAGES[blockedReason]}
        </div>
      )}

      {isPickerOpen && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <RelationTypePicker
            relationTypes={computed.activeRelationTypes}
            onSelect={handleSelectRelationType}
            onCancel={handleCancelPicker}
            currentRelationTypeId={editingEdge?.relationTypeId}
          />
        </div>
      )}

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        nodeCount={pendingDelete?.nodeIds.length ?? 0}
        connectedEdgeCount={
          pendingDelete ? selectConnectedEdgeIds(state, pendingDelete.nodeIds).length : 0
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
