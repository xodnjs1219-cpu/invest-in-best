"use client";

import { useCallback, useMemo, useState } from "react";
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
import { computeGroupBounds, toAbsolutePosition } from "@/features/valuechains/editor/lib/groupLayout";

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
  const { addEdge, changeEdgeRelation, deleteElements, moveNode, dissolveGroup, changeSelection } =
    useChainEditorActions();

  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [editingEdge, setEditingEdge] = useState<EditingEdge | null>(null);
  const [blockedReason, setBlockedReason] = useState<EdgeBlockReason | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ nodeIds: string[]; edgeIds: string[] } | null>(null);

  /**
   * 노드 우상단 삭제(×) 버튼 콜백 — 단일 문서 노드 삭제.
   * 연결된 엣지가 있으면 확인 다이얼로그를 띄우고(handleElementsDelete와 동일 규칙), 없으면 즉시 삭제한다.
   * selector에 주입되므로 참조 안정성이 필요해 useCallback으로 감싼다.
   */
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const connectedEdgeIds = selectConnectedEdgeIds(state, [nodeId]);
      if (connectedEdgeIds.length > 0) {
        setPendingDelete({ nodeIds: [nodeId], edgeIds: [] });
        return;
      }
      deleteElements({ nodeIds: [nodeId], edgeIds: [] });
    },
    [state, deleteElements],
  );

  /**
   * 엣지 라벨 우상단 삭제(×) 버튼 콜백 — 단일 관계(엣지) 삭제.
   * 엣지는 다른 요소와 종속 관계가 없어(엣지 하나만 사라짐) 확인 없이 즉시 삭제한다.
   */
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      deleteElements({ nodeIds: [], edgeIds: [edgeId] });
    },
    [deleteElements],
  );

  // selector는 매 호출 새 배열을 반환하므로 메모이즈해 참조를 안정화한다(ChainCanvas 동기화 effect의
  // 불필요한 재실행 방지 — 노드/그룹이 실제로 바뀔 때만 새 배열이 흘러가게 한다).
  const reactFlowNodes = useMemo(
    () => selectReactFlowNodes(state, undefined, handleDeleteNode),
    [state, handleDeleteNode],
  );
  const reactFlowEdges = useMemo(
    () => selectReactFlowEdges(state, computed.relationTypeById, { edgeIds: [] }, handleDeleteEdge),
    [state, computed.relationTypeById, handleDeleteEdge],
  );

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

  /**
   * 삭제 대상(React Flow가 보고하는 nodeIds)에서 그룹 노드 ID를 분리한다(UC-017 M13 — 선택 브리징).
   * 그룹 노드는 `dissolveGroup`으로 처리(확인 없음 — 노드 유지·E5), 문서 노드/엣지는 기존 흐름(UC-015/016).
   */
  const handleElementsDelete = (target: { nodeIds: string[]; edgeIds: string[] }) => {
    const groupIds = target.nodeIds.filter((id) => state.groups[id] !== undefined);
    const documentNodeIds = target.nodeIds.filter((id) => state.groups[id] === undefined);

    for (const groupId of groupIds) {
      dissolveGroup(groupId);
    }

    if (documentNodeIds.length === 0 && target.edgeIds.length === 0) {
      return;
    }

    const connectedEdgeIds = selectConnectedEdgeIds(state, documentNodeIds);
    if (connectedEdgeIds.length > 0) {
      setPendingDelete({ nodeIds: documentNodeIds, edgeIds: target.edgeIds });
      return;
    }
    deleteElements({ nodeIds: documentNodeIds, edgeIds: target.edgeIds });
  };

  const handleConfirmDelete = () => {
    if (pendingDelete) {
      const connectedEdgeIds = selectConnectedEdgeIds(state, pendingDelete.nodeIds);
      const edgeIds = [...new Set([...pendingDelete.edgeIds, ...connectedEdgeIds])];
      deleteElements({ nodeIds: pendingDelete.nodeIds, edgeIds });
      setPendingDelete(null);
    }
  };

  /**
   * 드래그 좌표 환원(UC-017 M13, G-5) — 소속 노드의 React Flow 상대 좌표를 절대 좌표로 환원해
   * moveNode(015 기여분)에 전달한다.
   * 그룹 노드 드래그 시에는 이동량(delta)을 그 그룹의 모든 멤버에 적용해 함께 옮긴다
   * (그룹 좌표는 비영속 파생값이므로, 멤버를 옮기면 다음 렌더에서 그룹이 자연히 따라온다).
   */
  const handleNodeDragStop = (nodeId: string, position: { x: number; y: number }) => {
    // ── 그룹 드래그 ──────────────────────────────────────
    if (state.groups[nodeId] !== undefined) {
      const memberPositions = Object.values(state.nodes)
        .filter((n) => n.groupClientId === nodeId)
        .map((n) => n.position);
      if (memberPositions.length === 0) {
        return; // 빈 그룹은 옮길 멤버가 없다(그룹 좌표는 파생값이라 영속 대상 아님).
      }
      const groupIndex = Object.keys(state.groups).indexOf(nodeId);
      const before = computeGroupBounds(memberPositions, groupIndex);
      const dx = position.x - before.position.x;
      const dy = position.y - before.position.y;
      if (dx === 0 && dy === 0) {
        return;
      }
      for (const member of Object.values(state.nodes)) {
        if (member.groupClientId === nodeId) {
          moveNode(member.clientNodeId, {
            x: member.position.x + dx,
            y: member.position.y + dy,
          });
        }
      }
      return;
    }

    // ── 일반 노드 드래그 ─────────────────────────────────
    const node = state.nodes[nodeId];
    if (!node) {
      return;
    }
    if (node.groupClientId === null) {
      moveNode(nodeId, position);
      return;
    }
    // 그룹 소속 노드의 상대 좌표를 절대 좌표로 환원한다.
    // React Flow가 자식 좌표 계산에 쓴 그룹 position은 "전체 멤버(드래그 노드 포함)의 드래그 전 위치"로
    // 계산된 bounds다. 드래그 노드를 제외하면 bounds가 어긋나 위치가 튄다(경계 노드일수록 크게).
    // 따라서 환원 기준은 반드시 전체 멤버의 드래그 전 위치로 계산해야 한다.
    const allMemberPositions = Object.values(state.nodes)
      .filter((n) => n.groupClientId === node.groupClientId)
      .map((n) => n.position);
    const groupIndex = Object.keys(state.groups).indexOf(node.groupClientId);
    const bounds = computeGroupBounds(allMemberPositions, groupIndex);
    const absolute = toAbsolutePosition(position, bounds.position);
    moveNode(nodeId, absolute);
  };

  /**
   * 선택 브리징(UC-017 M13) — 그룹 노드 ID를 문서 selection에서 제외해 문서 selection 오염을
   * 방지한다(문서 selection은 GroupPanel의 "선택 노드 그룹 지정"이 소비하는 노드 전용 목록이다).
   */
  const handleSelectionChange = (params: { nodeIds: string[]; edgeIds: string[] }) => {
    const documentNodeIds = params.nodeIds.filter((id) => state.groups[id] === undefined);
    changeSelection({ nodeIds: documentNodeIds, edgeIds: params.edgeIds });
  };

  const isPickerOpen = pendingConnection !== null || editingEdge !== null;

  return (
    <div className="relative">
      <ChainCanvas
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onConnect={handleConnect}
        onElementsDelete={handleElementsDelete}
        onNodeDragStop={handleNodeDragStop}
        onSelectionChange={handleSelectionChange}
        nodesConnectable={computed.hasActiveRelationTypes}
      />

      {blockedReason && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-sm text-danger shadow-[var(--shadow-sm)]">
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
