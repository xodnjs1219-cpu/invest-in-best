"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Skeleton } from "@/components/ui";
import { CompanyNode, type CompanyNodeType } from "@/components/mindmap/CompanyNode";
import { FreeSubjectNode, type FreeSubjectNodeType } from "@/components/mindmap/FreeSubjectNode";
import { GroupNode, type GroupNodeType } from "@/components/mindmap/GroupNode";
import { RelationEdge, directedArrowMarker } from "@/components/mindmap/RelationEdge";
import type { RenderGraph } from "@/components/mindmap/types";
import {
  computeGroupBounds,
  toAbsolutePosition,
  toRelativePosition,
} from "@/features/valuechains/editor/lib/groupLayout";
import { ChainNotFoundFallback } from "@/features/valuechains/components/ChainNotFoundFallback";
import { StructureErrorFallback } from "@/features/valuechains/components/StructureErrorFallback";
import {
  useChainViewActions,
  useChainViewState,
} from "@/features/valuechains/context/chain-view-context";

const nodeTypes: NodeTypes = {
  companyNode: CompanyNode,
  freeSubjectNode: FreeSubjectNode,
  groupNode: GroupNode,
};

const edgeTypes: EdgeTypes = {
  relationEdge: RelationEdge,
};

/** RenderGraph를 React Flow nodes/edges로 변환한다(그룹은 parent 노드 + 멤버 parentId). */
const toReactFlowElements = (
  renderGraph: RenderGraph,
  onToggleCollapse: (groupId: string) => void,
  selectedNodeId: string | null,
): { nodes: Node[]; edges: Edge[] } => {
  // 그룹 크기는 고정이 아니라 멤버 노드들의 bounding box에 맞춰 계산한다(편집기와 동일 규칙).
  // 그룹 좌표는 비영속 파생값이므로 항상 멤버 절대 좌표에서 유도하고, 멤버는 상대 좌표로 변환한다.
  const groupBoundsById = new Map<string, ReturnType<typeof computeGroupBounds>>();
  renderGraph.groups.forEach((group, index) => {
    const memberPositions = renderGraph.nodes
      .filter((n) => n.groupId === group.id)
      .map((n) => n.position);
    groupBoundsById.set(group.id, computeGroupBounds(memberPositions, index));
  });

  const groupNodes: Node<GroupNodeType["data"]>[] = renderGraph.groups.map((group) => {
    const bounds = groupBoundsById.get(group.id)!;
    return {
      id: `group:${group.id}`,
      type: "groupNode",
      position: bounds.position,
      // 그룹을 드래그로 옮길 수 있다 — 종료 시 delta를 멤버에 적용(handleDragStop).
      draggable: true,
      data: {
        label: group.label,
        isCollapsed: group.isCollapsed,
        memberCount: group.memberCount,
        onToggleCollapse: () => onToggleCollapse(group.id),
      },
      style: { width: bounds.width, height: bounds.height },
    };
  });

  const memberNodes: Node[] = renderGraph.nodes.map((node) => {
    // 그룹 소속 노드는 그룹 상대 좌표로 변환한다(React Flow Sub Flow 자식 좌표 규약).
    const groupBounds = node.groupId ? groupBoundsById.get(node.groupId) : undefined;
    const position = groupBounds
      ? toRelativePosition(node.position, groupBounds.position)
      : node.position;
    const base = {
      id: node.id,
      position,
      // 선택 노드 시각 강조(UC-011) — React Flow의 selected 속성으로 반영.
      selected: node.id === selectedNodeId,
      // `extent: "parent"`를 두지 않는다 — 멤버 노드를 그룹 경계에 가두지 않고 자유롭게 옮기게 하고,
      // 놓으면 그룹 bounds가 그 노드를 포함하도록 가변적으로 늘어난다(computeGroupBounds 재계산).
      ...(node.groupId ? { parentId: `group:${node.groupId}` } : {}),
    };

    if (node.kind === "listed_company") {
      return {
        ...base,
        type: "companyNode",
        data: {
          label: node.label,
          sublabel: node.sublabel,
          market: node.market,
          listingStatus: node.listingStatus,
        },
      } satisfies Node<CompanyNodeType["data"]>;
    }

    return {
      ...base,
      type: "freeSubjectNode",
      data: { label: node.label, subjectType: node.subjectType ?? "other" },
    } satisfies Node<FreeSubjectNodeType["data"]>;
  });

  const edges: Edge[] = renderGraph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "relationEdge",
    // 유향 관계는 뷰어에서도 화살표(markerEnd)로 방향을 드러낸다(편집기와 동일 마커).
    markerEnd: directedArrowMarker(edge.isDirected),
    data: { label: edge.label, isDirected: edge.isDirected },
  }));

  return { nodes: [...groupNodes, ...memberNodes], edges };
};

const MindmapCanvasInner = () => {
  const { structure, renderGraph, selectedNodeId } = useChainViewState();
  const { commitNodeDrag, toggleGroupCollapse, selectNode, closeNodePanel } = useChainViewActions();

  const { nodes: nodesFromGraph, edges: edgesFromGraph } = useMemo(() => {
    if (!renderGraph) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }
    return toReactFlowElements(renderGraph, toggleGroupCollapse, selectedNodeId);
  }, [renderGraph, toggleGroupCollapse, selectedNodeId]);

  // React Flow controlled 배선(v12, error#015) — onNodesChange 미배선 시 노드 측정이 갱신되지 않아
  // 더블클릭/줌 등에서 노드가 사라진다. 내부 상태를 두고, 그래프 파생 노드를 id 기준으로 병합한다
  // (기존 노드의 measured 등 런타임 필드 보존).
  const [nodes, setNodes, onNodesChange] = useNodesState(nodesFromGraph);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesFromGraph);

  useEffect(() => {
    setNodes((current) => {
      const currentById = new Map(current.map((n) => [n.id, n]));
      return nodesFromGraph.map((incoming) => {
        const existing = currentById.get(incoming.id);
        return existing
          ? {
              ...incoming,
              measured: existing.measured,
              width: existing.width,
              height: existing.height,
            }
          : incoming;
      });
    });
  }, [nodesFromGraph, setNodes]);

  useEffect(() => {
    setEdges(edgesFromGraph);
  }, [edgesFromGraph, setEdges]);

  // ── 강조/흐림(dim) — hover 미리보기 + 클릭 선택(지속) ────────────────────
  // 노드를 클릭하면(selectedNodeId) 그 노드와 연결된 엣지·이웃 노드를 강하게 강조하고 나머지는 흐린다.
  // hover는 순간 미리보기. 활성 대상 = hover가 있으면 hover, 없으면 클릭 선택.
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const activeNodeId = hoveredNodeId ?? selectedNodeId;

  const neighborIds = useMemo(() => {
    if (!activeNodeId) return null;
    const set = new Set<string>([activeNodeId]);
    for (const e of edges) {
      if (e.source === activeNodeId) set.add(e.target);
      if (e.target === activeNodeId) set.add(e.source);
    }
    return set;
  }, [activeNodeId, edges]);

  const displayNodes = useMemo(() => {
    if (!neighborIds) return nodes;
    return nodes.map((n) => {
      if (n.type === "groupNode") return n;
      const emphasized = neighborIds.has(n.id);
      return { ...n, data: { ...n.data, isEmphasized: emphasized, isDimmed: !emphasized } };
    });
  }, [nodes, neighborIds]);

  const displayEdges = useMemo(() => {
    if (!activeNodeId) return edges;
    return edges.map((e) => {
      const connected = e.source === activeNodeId || e.target === activeNodeId;
      return { ...e, data: { ...e.data, isEmphasized: connected, isDimmed: !connected } };
    });
  }, [edges, activeNodeId]);

  /**
   * 드래그 종료 처리 — 일반 노드는 위치를 그대로 커밋하고, 그룹 노드(id=`group:…`)는 이동량(delta)을
   * 멤버 노드들에 적용해 함께 옮긴다(그룹 좌표는 멤버에서 파생되므로 멤버를 옮기면 그룹이 따라온다).
   */
  const handleDragStop = (nodeId: string, position: { x: number; y: number }) => {
    if (nodeId.startsWith("group:") && renderGraph) {
      const groupId = nodeId.slice("group:".length);
      const memberPositions = renderGraph.nodes
        .filter((n) => n.groupId === groupId)
        .map((n) => n.position);
      if (memberPositions.length === 0) return;
      const groupIndex = renderGraph.groups.findIndex((g) => g.id === groupId);
      const before = computeGroupBounds(memberPositions, groupIndex);
      const dx = position.x - before.position.x;
      const dy = position.y - before.position.y;
      if (dx === 0 && dy === 0) return;
      for (const n of renderGraph.nodes) {
        if (n.groupId === groupId) {
          commitNodeDrag(n.id, { x: n.position.x + dx, y: n.position.y + dy });
        }
      }
      return;
    }

    // 일반 노드: 그룹 소속이면 상대 좌표를 절대 좌표로 환원해 커밋한다(편집기와 동일 규칙).
    // 환원 기준은 전체 멤버(드래그 노드 포함)의 현재 위치로 계산한 bounds여야 좌표가 튀지 않는다.
    const dragged = renderGraph?.nodes.find((n) => n.id === nodeId);
    if (dragged?.groupId) {
      const memberPositions = renderGraph!.nodes
        .filter((n) => n.groupId === dragged.groupId)
        .map((n) => n.position);
      const groupIndex = renderGraph!.groups.findIndex((g) => g.id === dragged.groupId);
      const bounds = computeGroupBounds(memberPositions, groupIndex);
      commitNodeDrag(nodeId, toAbsolutePosition(position, bounds.position));
      return;
    }
    commitNodeDrag(nodeId, position);
  };

  // 시점 복원 중 여부(UC-012) — ready 상태에서만 노출되며 UC-009는 항상 false.
  const isRestoring = structure.status === "ready" && structure.isRestoring;

  if (structure.status === "loading") {
    return <Skeleton data-testid="mindmap-skeleton" className="h-[clamp(480px,68vh,720px)] w-full" />;
  }

  if (structure.status === "not-found") {
    return <ChainNotFoundFallback />;
  }

  if (structure.status === "error") {
    return <StructureErrorFallback />;
  }

  return (
    // 뷰어 마인드맵은 넓은 화면을 활용하도록 높이를 화면 비례로 키운다(작은 화면은 480px 하한).
    <div
      className="relative h-[clamp(480px,68vh,720px)] w-full rounded-[var(--radius-lg)] border border-border"
      data-mm-hovering={activeNodeId ? "true" : undefined}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDragStop={(_, n) => handleDragStop(n.id, n.position)}
        onNodeMouseEnter={(_, n) => n.type !== "groupNode" && setHoveredNodeId(n.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onNodeClick={(_, n) => {
          // 그룹 클러스터(Sub Flow 부모 노드)는 클릭 대상에서 제외한다.
          // 노드 클릭 → 선택(selectedNodeId)으로 그 노드와 연결 엣지·이웃을 지속 강조한다(상세 이동 대신).
          if (n.type === "groupNode") return;
          // 같은 노드 재클릭이면 선택 해제, 아니면 선택.
          if (selectedNodeId === n.id) {
            closeNodePanel();
          } else {
            selectNode(n.id);
          }
        }}
        onPaneClick={() => closeNodePanel()}
        onlyRenderVisibleElements
        fitView
        // 줌 범위 확장 — 큰 밸류체인(노드 최대 100개)도 한눈에 보이도록 축소를 넉넉히 허용한다.
        minZoom={0.1}
        maxZoom={2.5}
        zoomOnDoubleClick={false}
      />
      {/* 시점 복원 중 인디케이터(UC-012) — 스냅샷 조회 중 캔버스 위에 표시. */}
      {isRestoring && (
        <div
          data-testid="mindmap-restoring-indicator"
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-raised/50"
        >
          <span className="rounded-full bg-fg/80 px-4 py-2 text-sm font-medium text-surface-raised">
            시점 구성을 불러오는 중…
          </span>
        </div>
      )}
      {/* 조작 힌트 — 옵시디언식 인터랙션 발견성(좌하단, 장식이라 클릭 불가). */}
      <div className="pointer-events-none absolute bottom-3 left-3 hidden items-center gap-2 rounded-full border border-border bg-surface-raised/80 px-3 py-1 text-[11px] text-fg-muted backdrop-blur sm:flex">
        <span>노드 클릭 → 상세</span>
        <span className="text-border-strong" aria-hidden>·</span>
        <span>hover → 연결 강조</span>
      </div>
      {selectedNodeId !== null && (
        <span data-testid="mindmap-selected-node-id" className="sr-only">
          {selectedNodeId}
        </span>
      )}
    </div>
  );
};

/**
 * 마인드맵 캔버스 (plan 모듈 C6) — `structure.status` 분기 + React Flow 렌더.
 * `useChainViewState()`/`useChainViewActions()` 두 훅 외 데이터 접근 없음(쿼리 훅·dispatch·라우터 직접 사용 금지).
 * 노드 클릭(UC-011): `onNodeClick`이 `selectNode(nodeId)`를 호출해 S3를 갱신한다.
 * 그룹 클러스터(`groupNode`) 클릭은 노드 상세 조회 대상에서 제외한다.
 */
export const MindmapCanvas = () => (
  <ReactFlowProvider>
    <MindmapCanvasInner />
  </ReactFlowProvider>
);
