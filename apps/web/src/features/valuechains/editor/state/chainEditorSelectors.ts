import { MarkerType, type Edge, type Node } from "@xyflow/react";
import {
  MAX_NODES_PER_CHAIN,
  NODE_LIMIT_WARNING_THRESHOLD,
  validateChainNameFormat,
  type RelationType,
} from "@iib/domain";
import type { CompanyNodeData } from "@/components/mindmap/CompanyNode";
import type { FreeSubjectNodeData } from "@/components/mindmap/FreeSubjectNode";
import type { RelationEdgeData } from "@/components/mindmap/RelationEdge";
import type { ChainEditorState } from "./chainEditorReducer";

/**
 * chain-editor 파생 셀렉터 (UC-013 plan 모듈 6, state_management.md §4.4).
 * 상태로 두지 않는 파생값을 렌더 시 계산한다 — React 비의존 순수 함수.
 * 본 파일은 UC-013(노드 수·이름 이슈) + UC-015(노드 상한/중복) + UC-016(엣지 매핑)을 구현한다.
 */

/** 캔버스 노드 수 — 툴바 배지용. */
export function selectNodeCount(state: ChainEditorState): number {
  return Object.keys(state.nodes).length;
}

/** 메타 패널 이름 필드 오류 표시용. */
export function selectNameIssue(state: ChainEditorState): "NAME_REQUIRED" | null {
  return validateChainNameFormat(state.name);
}

// ============================================================================
// UC-015: 노드 상한/중복 파생 셀렉터
// ============================================================================

/** 잔여 노드 추가 가능 수 — 음수 방어(초과 상태에서도 0). */
export function selectRemainingNodeCapacity(state: ChainEditorState): number {
  return Math.max(0, MAX_NODES_PER_CHAIN - selectNodeCount(state));
}

/** 노드 상한 근접 여부(잔여 수 안내 배지 트리거). */
export function selectIsNearNodeLimit(state: ChainEditorState): boolean {
  return selectNodeCount(state) >= NODE_LIMIT_WARNING_THRESHOLD;
}

/** 상장기업 노드가 사용 중인 securityId 집합 — 검색 결과 "이미 추가됨" 표시용. */
export function selectUsedSecurityIds(state: ChainEditorState): Set<string> {
  const ids = new Set<string>();
  for (const node of Object.values(state.nodes)) {
    if (node.nodeKind === "listed_company") {
      ids.add(node.security.securityId);
    }
  }
  return ids;
}

/** 주어진 노드들에 연결된 엣지 ID(source/target 어느 쪽이든, 중복 없음) — 삭제 확인 다이얼로그 분기용(E7). */
export function selectConnectedEdgeIds(state: ChainEditorState, nodeIds: string[]): string[] {
  const nodeIdSet = new Set(nodeIds);
  const connected = new Set<string>();
  for (const edge of Object.values(state.edges)) {
    if (nodeIdSet.has(edge.sourceClientNodeId) || nodeIdSet.has(edge.targetClientNodeId)) {
      connected.add(edge.clientEdgeId);
    }
  }
  return [...connected];
}

// ============================================================================
// UC-016: 엣지 React Flow 매핑 셀렉터
// ============================================================================

const FALLBACK_RELATION_LABEL = "관계 종류 없음";

export interface EdgeHighlight {
  edgeIds: string[];
}

/**
 * EditorEdge → React Flow Edge 매핑(state_management.md §4.4).
 * 라벨=마스터 최신 이름(BR-6), markerEnd=isDirected일 때만, isHighlighted=422 오류 위치 표시(E7).
 */
export function selectReactFlowEdges(
  state: ChainEditorState,
  relationTypeById: ReadonlyMap<string, Pick<RelationType, "name" | "isDirected" | "isActive">>,
  highlight: EdgeHighlight,
): Edge<RelationEdgeData>[] {
  const highlightSet = new Set(highlight.edgeIds);

  return Object.values(state.edges).map((edge) => {
    const relationType = relationTypeById.get(edge.relationTypeId);
    const isDirected = relationType?.isDirected ?? true;

    return {
      id: edge.clientEdgeId,
      source: edge.sourceClientNodeId,
      target: edge.targetClientNodeId,
      type: "relationEdge",
      markerEnd: isDirected ? MarkerType.ArrowClosed : undefined,
      data: {
        label: relationType?.name ?? FALLBACK_RELATION_LABEL,
        isDirected,
        isInactiveType: relationType ? !relationType.isActive : false,
        isHighlighted: highlightSet.has(edge.clientEdgeId),
      },
    } satisfies Edge<RelationEdgeData>;
  });
}

// ============================================================================
// UC-015: 노드 React Flow 매핑 셀렉터
// ============================================================================

type EditorFlowNode = Node<CompanyNodeData> | Node<FreeSubjectNodeData>;

/**
 * EditorNode → React Flow Node 매핑 — 뷰(UC-009)의 `CompanyNode`/`FreeSubjectNode` 프레젠터를
 * 편집 캔버스에서도 재사용한다(공통 프레젠테이션). `parentId`(그룹 Sub Flow)는 UC-017 plan이 확장.
 */
export function selectReactFlowNodes(state: ChainEditorState): EditorFlowNode[] {
  return Object.values(state.nodes).map((node) => {
    if (node.nodeKind === "listed_company") {
      return {
        id: node.clientNodeId,
        type: "companyNode",
        position: node.position,
        data: {
          label: node.security.name,
          sublabel: node.security.ticker,
          market: node.security.market,
        },
      } satisfies Node<CompanyNodeData>;
    }

    return {
      id: node.clientNodeId,
      type: "freeSubjectNode",
      position: node.position,
      data: {
        label: node.subjectName,
        subjectType: node.subjectType,
      },
    } satisfies Node<FreeSubjectNodeData>;
  });
}
