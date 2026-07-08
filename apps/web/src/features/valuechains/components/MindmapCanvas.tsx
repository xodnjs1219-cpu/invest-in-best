"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CompanyNode, type CompanyNodeType } from "@/components/mindmap/CompanyNode";
import { FreeSubjectNode, type FreeSubjectNodeType } from "@/components/mindmap/FreeSubjectNode";
import { GroupNode, type GroupNodeType } from "@/components/mindmap/GroupNode";
import { RelationEdge } from "@/components/mindmap/RelationEdge";
import type { RenderGraph } from "@/components/mindmap/types";
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
): { nodes: Node[]; edges: Edge[] } => {
  const groupNodes: Node<GroupNodeType["data"]>[] = renderGraph.groups.map((group, index) => ({
    id: `group:${group.id}`,
    type: "groupNode",
    position: { x: index * 360, y: -60 },
    data: {
      label: group.label,
      isCollapsed: group.isCollapsed,
      memberCount: group.memberCount,
      onToggleCollapse: () => onToggleCollapse(group.id),
    },
    style: { width: 320, height: 260 },
  }));

  const memberNodes: Node[] = renderGraph.nodes.map((node) => {
    const base = {
      id: node.id,
      position: node.position,
      ...(node.groupId ? { parentId: `group:${node.groupId}`, extent: "parent" as const } : {}),
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
    data: { label: edge.label, isDirected: edge.isDirected },
  }));

  return { nodes: [...groupNodes, ...memberNodes], edges };
};

const MindmapCanvasInner = () => {
  const { structure, renderGraph, selectedNodeId } = useChainViewState();
  const { commitNodeDrag, toggleGroupCollapse, selectNode } = useChainViewActions();

  const { nodes, edges } = useMemo(() => {
    if (!renderGraph) {
      return { nodes: [], edges: [] };
    }
    return toReactFlowElements(renderGraph, toggleGroupCollapse);
  }, [renderGraph, toggleGroupCollapse]);

  if (structure.status === "loading") {
    return (
      <div
        data-testid="mindmap-skeleton"
        className="h-[480px] w-full animate-pulse rounded-lg bg-gray-100"
      />
    );
  }

  if (structure.status === "not-found") {
    return <ChainNotFoundFallback />;
  }

  if (structure.status === "error") {
    return <StructureErrorFallback />;
  }

  return (
    <div className="h-[480px] w-full rounded-lg border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDragStop={(_, n) => commitNodeDrag(n.id, n.position)}
        onNodeClick={(_, n) => {
          // 그룹 클러스터(Sub Flow 부모 노드)는 노드 유형이 아니므로 클릭 대상에서 제외한다(UC-011).
          if (n.type === "groupNode") {
            return;
          }
          selectNode(n.id);
        }}
        onlyRenderVisibleElements
        fitView
      />
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
