"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CanvasControls,
  CanvasLegend,
  CanvasMiniMap,
  MM_BACKGROUND_PROPS,
} from "@/components/mindmap/CanvasChrome";
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
  /**
   * 노드 클릭 콜백(그룹 노드 제외). 클릭 강조는 캔버스가 자체 처리하며, 이 콜백은 호출측이
   * 추가 동작(예: 정보 패널 열기)을 원할 때만 사용한다.
   */
  onNodeClick?: (nodeId: string) => void;
  /** 노드/엣지 선택 삭제(Delete 키·컨텍스트 액션) — 확인 다이얼로그는 호출측 책임(UC-015 E7). */
  onElementsDelete?: (params: { nodeIds: string[]; edgeIds: string[] }) => void;
  /** false면 연결 제스처 비활성 + 안내 배너(E6 — 활성 관계 종류 0개, E10 — 마스터 로드 실패). */
  nodesConnectable?: boolean;
  /** 좌하단 범례에 표시할 그룹(라벨+tone) — 미전달 시 관례·힌트만 표시. */
  legendGroups?: readonly { label: string; tone: number }[];
}

const EMPTY_STATE_MESSAGE = "노드를 추가해 밸류체인을 구성하세요";
const CONNECT_DISABLED_MESSAGE = "관계 설정 불가 — 활성화된 관계 종류가 없습니다";

// 매 렌더마다 새 배열 리터럴을 기본값으로 쓰면 동기화 useEffect가 무한 반복하므로, 안정 참조를 공유한다.
const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: Edge[] = [];

function ChainCanvasInner({
  nodes: nodesProp = EMPTY_NODES,
  edges: edgesProp = EMPTY_EDGES,
  onNodeDragStop,
  onSelectionChange,
  onConnect,
  onNodeClick,
  onElementsDelete,
  nodesConnectable = true,
  legendGroups,
}: ChainCanvasProps) {
  // React Flow는 controlled `nodes`를 넘길 때 `onNodesChange`가 필수다(v12, error#015). 배선하지 않으면
  // 내부 노드 측정(measured)/초기화가 갱신되지 않아, 페인 더블클릭(줌) 등 내부 상태 변경 시 노드가 사라진다.
  // 따라서 React Flow 내부 상태(useNodesState)를 두고 onNodesChange를 배선하되, 문서 SOT에서 파생된 prop을
  // 통째로 교체하면 measured가 리셋되므로(다시 uninitialized), 아래 useEffect에서 id 기준으로 병합한다.
  const [nodes, setNodes, onNodesChange] = useNodesState(nodesProp);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesProp);

  // 부모가 새 노드 배열을 내려주면(추가/삭제/시점 복원/좌표 커밋) id 기준으로 병합한다.
  // 기존 노드는 React Flow가 관리하는 런타임 필드(measured/width/height/selected/dragging)를 보존하고,
  // SOT가 소유하는 필드(position/data/type/…)만 갱신한다. 이러면 측정 상태가 유지돼 노드가 사라지지 않는다.
  useEffect(() => {
    setNodes((current) => {
      const currentById = new Map(current.map((n) => [n.id, n]));
      return nodesProp.map((incoming) => {
        const existing = currentById.get(incoming.id);
        if (!existing) {
          return incoming;
        }
        return {
          ...incoming,
          measured: existing.measured,
          width: existing.width,
          height: existing.height,
          selected: existing.selected,
          dragging: existing.dragging,
        };
      });
    });
  }, [nodesProp, setNodes]);

  useEffect(() => {
    setEdges(edgesProp);
  }, [edgesProp, setEdges]);

  const isEmpty = nodes.length === 0;

  // ── 옵시디언식 강조/흐림(dim) — hover 미리보기 + 클릭 선택(지속) ────────────
  // 노드를 클릭하면 그 노드와 연결된 엣지·이웃 노드를 강하게 강조하고 나머지는 흐린다(선택은 지속).
  // hover는 순간 미리보기. 활성 대상 = hover가 있으면 hover, 없으면 클릭 선택.
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const activeNodeId = hoveredNodeId ?? selectedNodeId;

  // 활성 노드의 이웃 노드 집합(연결된 엣지의 반대편). 그룹 노드는 강조 대상에서 제외한다.
  const neighborIds = useMemo(() => {
    if (!activeNodeId) return null;
    const set = new Set<string>([activeNodeId]);
    for (const e of edges) {
      if (e.source === activeNodeId) set.add(e.target);
      if (e.target === activeNodeId) set.add(e.source);
    }
    return set;
  }, [activeNodeId, edges]);

  // 강조 상태를 노드/엣지 data에 주입한 표시용 파생 배열(원본 state는 불변).
  // 플래그가 실제로 바뀌는 항목만 새 객체로 교체(참조 보존) — hover마다 전량 리렌더 방지(뷰어와 동일 패턴).
  const displayNodes = useMemo(() => {
    if (!neighborIds) return nodes;
    return nodes.map((n) => {
      if (n.type === "groupNode") return n; // 그룹 클러스터는 dim 대상에서 제외
      const emphasized = neighborIds.has(n.id);
      if (n.data.isEmphasized === emphasized && n.data.isDimmed === !emphasized) return n;
      return { ...n, data: { ...n.data, isEmphasized: emphasized, isDimmed: !emphasized } };
    });
  }, [nodes, neighborIds]);

  const displayEdges = useMemo(() => {
    if (!activeNodeId) return edges;
    return edges.map((e) => {
      const connected = e.source === activeNodeId || e.target === activeNodeId;
      if (e.data?.isEmphasized === connected && e.data?.isDimmed === !connected) return e;
      return { ...e, data: { ...e.data, isEmphasized: connected, isDimmed: !connected } };
    });
  }, [edges, activeNodeId]);

  return (
    <div
      className="relative h-[clamp(480px,68vh,720px)] w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface-sunken"
      data-mm-hovering={activeNodeId ? "true" : undefined}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodeMouseEnter={(_, n) => n.type !== "groupNode" && setHoveredNodeId(n.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onNodeClick={(_, n) => {
          if (n.type === "groupNode") return;
          // 같은 노드 재클릭 시 선택 해제, 아니면 그 노드를 지속 강조 대상으로 선택한다.
          setSelectedNodeId((prev) => (prev === n.id ? null : n.id));
          onNodeClick?.(n.id);
        }}
        onPaneClick={() => setSelectedNodeId(null)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
        // 줌 범위 확장 — 큰 밸류체인(노드 최대 100개)도 한눈에 보이도록 축소를 넉넉히 허용한다.
        minZoom={0.1}
        maxZoom={2.5}
        // 노드 선택(클릭) 시 연결 엣지의 SVG가 라벨 레이어 위로 올라가 관계 타이틀을 덮는 것을 막는다.
        // (React Flow 기본 elevateEdgesOnSelect=true 여파 — 강조는 data 기반이라 elevate 불필요)
        elevateEdgesOnSelect={false}
        // 페인 빈 곳 더블클릭 시 줌인되면 노드가 화면 밖으로 밀려나 "노드가 사라진 것처럼" 보인다.
        // 밸류체인 캔버스에서 더블클릭 줌은 불필요하므로 비활성화한다(줌은 휠·컨트롤로만).
        zoomOnDoubleClick={false}
      >
        {/* 은은한 배경 입자 — 뷰어와 동일한 도트 그리드(§4 캔버스 크롬). */}
        <Background {...MM_BACKGROUND_PROPS} />
        <CanvasMiniMap />
      </ReactFlow>
      {/* 캔버스 컨트롤(확대/축소/전체 보기) — 우상단. */}
      <CanvasControls />
      {/* 범례 — 그룹 tone·표기 관례·편집 힌트(좌하단). */}
      <CanvasLegend
        groups={legendGroups ?? []}
        hints={["핸들 드래그 → 연결", "Delete → 선택 삭제"]}
      />
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-[var(--radius)] bg-surface-raised/80 px-4 py-2 text-sm text-fg-muted">
            {EMPTY_STATE_MESSAGE}
          </p>
        </div>
      )}
      {!nodesConnectable && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
          <p className="rounded-[var(--radius)] bg-warning-soft px-3 py-1.5 text-xs text-warning">
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
