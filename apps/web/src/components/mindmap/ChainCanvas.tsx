"use client";

import { ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeTypes, type EdgeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CompanyNode } from "@/components/mindmap/CompanyNode";
import { FreeSubjectNode } from "@/components/mindmap/FreeSubjectNode";
import { GroupNode } from "@/components/mindmap/GroupNode";
import { RelationEdge } from "@/components/mindmap/RelationEdge";

/**
 * 공용 React Flow 캔버스 프레젠테이션 (UC-013 plan 모듈 21, UC-015/016/017 확장).
 * 뷰(UC-009~012, `MindmapCanvas`)와 편집(UC-015~018 `ChainEditorPage`) 공용 — 콜백은 전부 optional,
 * 도메인 타입 비의존(React Flow `Node[]`/`Edge[]`만 수용).
 * `nodeTypes`/`edgeTypes`는 뷰/편집 공용 프레젠터(`CompanyNode`/`FreeSubjectNode`/`GroupNode`/`RelationEdge`)를 등록한다.
 */

const NODE_TYPES: NodeTypes = {
  companyNode: CompanyNode,
  freeSubjectNode: FreeSubjectNode,
  groupNode: GroupNode,
};

const EDGE_TYPES: EdgeTypes = {
  relationEdge: RelationEdge,
};

export interface ChainCanvasProps {
  nodes?: Node[];
  edges?: Edge[];
  onNodeDragStop?: (nodeId: string, position: { x: number; y: number }) => void;
  onSelectionChange?: (params: { nodeIds: string[]; edgeIds: string[] }) => void;
  onConnect?: (params: { source: string; target: string }) => void;
  /** 노드/엣지 선택 삭제(Delete 키·컨텍스트 액션) — 확인 다이얼로그는 호출측 책임(UC-015 E7). */
  onElementsDelete?: (params: { nodeIds: string[]; edgeIds: string[] }) => void;
  /** false면 연결 제스처 비활성 + 안내 배너(E6 — 활성 관계 종류 0개, E10 — 마스터 로드 실패). */
  nodesConnectable?: boolean;
}

const EMPTY_STATE_MESSAGE = "노드를 추가해 밸류체인을 구성하세요";
const CONNECT_DISABLED_MESSAGE = "관계 설정 불가 — 활성화된 관계 종류가 없습니다";

function ChainCanvasInner({
  nodes = [],
  edges = [],
  onNodeDragStop,
  onSelectionChange,
  onConnect,
  onElementsDelete,
  nodesConnectable = true,
}: ChainCanvasProps) {
  const isEmpty = nodes.length === 0;

  return (
    <div className="relative h-[480px] w-full rounded-lg border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesConnectable={nodesConnectable}
        deleteKeyCode={onElementsDelete ? null : undefined}
        onNodeDragStop={
          onNodeDragStop ? (_, n) => onNodeDragStop(n.id, n.position) : undefined
        }
        onSelectionChange={
          onSelectionChange
            ? (params) =>
                onSelectionChange({
                  nodeIds: params.nodes.map((n) => n.id),
                  edgeIds: params.edges.map((e) => e.id),
                })
            : undefined
        }
        onConnect={
          onConnect
            ? (connection) => {
                if (connection.source && connection.target) {
                  onConnect({ source: connection.source, target: connection.target });
                }
              }
            : undefined
        }
        isValidConnection={(connection) => connection.source !== connection.target}
        onlyRenderVisibleElements
        fitView
      />
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-md bg-white/80 px-4 py-2 text-sm text-gray-500">
            {EMPTY_STATE_MESSAGE}
          </p>
        </div>
      )}
      {!nodesConnectable && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
          <p className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
            {CONNECT_DISABLED_MESSAGE}
          </p>
        </div>
      )}
    </div>
  );
}

export function ChainCanvas(props: ChainCanvasProps) {
  return (
    <ReactFlowProvider>
      <ChainCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
