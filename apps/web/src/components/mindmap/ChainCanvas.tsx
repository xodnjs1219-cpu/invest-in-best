"use client";

import { ReactFlow, ReactFlowProvider, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/**
 * 공용 React Flow 캔버스 프레젠테이션 (UC-013 plan 모듈 21).
 * 뷰(UC-009~012, `MindmapCanvas`)와 편집(UC-015~018 `ChainEditorPage`) 공용 — 콜백은 전부 optional,
 * 도메인 타입 비의존(React Flow `Node[]`/`Edge[]`만 수용).
 * 본 plan에서는 **빈 캔버스 장착만** 수행한다 — 커스텀 노드 타입·엣지 라벨·그룹(Sub Flow) 매핑은
 * UC-015~017 plan이 `nodeTypes`/`edgeTypes` props 확장으로 이어받는다.
 */

export interface ChainCanvasProps {
  nodes?: Node[];
  edges?: Edge[];
  onNodeDragStop?: (nodeId: string, position: { x: number; y: number }) => void;
  onSelectionChange?: (params: { nodeIds: string[]; edgeIds: string[] }) => void;
  onConnect?: (params: { source: string; target: string }) => void;
}

const EMPTY_STATE_MESSAGE = "노드를 추가해 밸류체인을 구성하세요";

function ChainCanvasInner({ nodes = [], edges = [], onNodeDragStop, onSelectionChange, onConnect }: ChainCanvasProps) {
  const isEmpty = nodes.length === 0;

  return (
    <div className="relative h-[480px] w-full rounded-lg border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
