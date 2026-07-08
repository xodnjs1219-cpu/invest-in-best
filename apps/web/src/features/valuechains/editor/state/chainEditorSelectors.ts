import { MarkerType, type Edge, type Node } from "@xyflow/react";
import {
  MAX_NODES_PER_CHAIN,
  NODE_LIMIT_WARNING_THRESHOLD,
  validateChainNameFormat,
  type RelationType,
  type SaveChainRequest,
  type ServerIssue,
} from "@iib/domain";
import type { CompanyNodeData } from "@/components/mindmap/CompanyNode";
import type { FreeSubjectNodeData } from "@/components/mindmap/FreeSubjectNode";
import type { GroupNodeData } from "@/components/mindmap/GroupNode";
import type { RelationEdgeData } from "@/components/mindmap/RelationEdge";
import { computeGroupBounds, toRelativePosition } from "@/features/valuechains/editor/lib/groupLayout";
import type { ChainEditorState } from "./chainEditorReducer";

/**
 * chain-editor 파생 셀렉터 (UC-013 plan 모듈 6, state_management.md §4.4).
 * 상태로 두지 않는 파생값을 렌더 시 계산한다 — React 비의존 순수 함수.
 * 본 파일은 UC-013(노드 수·이름 이슈) + UC-015(노드 상한/중복) + UC-016(엣지 매핑)
 * + UC-017(그룹 소속·React Flow Sub Flow 매핑) + UC-018(저장 직렬화·이슈 하이라이트)을 구현한다.
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
type EditorFlowGroupNode = Node<GroupNodeData>;

// ============================================================================
// UC-017: 그룹 파생 셀렉터
// ============================================================================

/** groupClientId → clientNodeIds[] 역인덱스(노드 측 단일 소스에서 파생). */
export function selectGroupMembership(state: ChainEditorState): ReadonlyMap<string, string[]> {
  const membership = new Map<string, string[]>();
  for (const node of Object.values(state.nodes)) {
    if (node.groupClientId === null) {
      continue;
    }
    const members = membership.get(node.groupClientId) ?? [];
    members.push(node.clientNodeId);
    membership.set(node.groupClientId, members);
  }
  return membership;
}

/** 멤버 0개 그룹(저장 시 제외 예고 안내 — BR-6). */
export function selectEmptyGroupIds(state: ChainEditorState): string[] {
  const membership = selectGroupMembership(state);
  return Object.keys(state.groups).filter((groupId) => (membership.get(groupId)?.length ?? 0) === 0);
}

/** name.trim() 완전 일치 기준으로 2회 이상 등장하는 이름 목록(알림용 — 차단 아님, E3·BR-4). */
export function selectDuplicateGroupNames(state: ChainEditorState): string[] {
  const counts = new Map<string, number>();
  for (const group of Object.values(state.groups)) {
    const name = group.name.trim();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

export interface NodeFlowHighlight {
  groupIds?: string[];
}

/**
 * EditorNode/EditorGroup → React Flow Node 매핑(그룹=React Flow Sub Flow parent, UC-017 M8).
 * 뷰(UC-009)의 `CompanyNode`/`FreeSubjectNode`/`GroupNode` 프레젠터를 편집 캔버스에서도 재사용한다.
 * 배열 순서: 그룹(parent) 노드를 소속 노드보다 앞에 배치(React Flow Sub Flow 요구사항).
 * 소속 노드는 `parentId`를 부여받고 좌표를 절대→상대로 변환한다(문서 상태는 항상 절대 좌표).
 */
export function selectReactFlowNodes(
  state: ChainEditorState,
  highlight: NodeFlowHighlight = {},
): (EditorFlowNode | EditorFlowGroupNode)[] {
  const membership = selectGroupMembership(state);
  const highlightGroupIds = new Set(highlight.groupIds ?? []);

  const groupEntries = Object.values(state.groups);
  const groupBoundsById = new Map<string, ReturnType<typeof computeGroupBounds>>();
  groupEntries.forEach((group, index) => {
    const memberIds = membership.get(group.clientGroupId) ?? [];
    const memberPositions = memberIds
      .map((id) => state.nodes[id]?.position)
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
    groupBoundsById.set(group.clientGroupId, computeGroupBounds(memberPositions, index));
  });

  const groupNodes: EditorFlowGroupNode[] = groupEntries.map((group) => {
    const bounds = groupBoundsById.get(group.clientGroupId)!;
    const memberCount = membership.get(group.clientGroupId)?.length ?? 0;
    return {
      id: group.clientGroupId,
      type: "groupNode",
      position: bounds.position,
      width: bounds.width,
      height: bounds.height,
      draggable: false,
      selectable: true,
      zIndex: -1,
      data: {
        label: group.name,
        memberCount,
        isEmpty: memberCount === 0,
        isHighlighted: highlightGroupIds.has(group.clientGroupId),
      },
    } satisfies EditorFlowGroupNode;
  });

  const memberNodes: (EditorFlowNode)[] = Object.values(state.nodes).map((node) => {
    const groupId = node.groupClientId;
    const bounds = groupId !== null ? groupBoundsById.get(groupId) : undefined;
    const position = bounds ? toRelativePosition(node.position, bounds.position) : node.position;
    const parentPatch = groupId !== null && bounds ? { parentId: groupId } : {};

    if (node.nodeKind === "listed_company") {
      return {
        id: node.clientNodeId,
        type: "companyNode",
        position,
        ...parentPatch,
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
      position,
      ...parentPatch,
      data: {
        label: node.subjectName,
        subjectType: node.subjectType,
      },
    } satisfies Node<FreeSubjectNodeData>;
  });

  return [...groupNodes, ...memberNodes];
}

// ============================================================================
// UC-018: 저장 직렬화·이슈 하이라이트 셀렉터
// ============================================================================

/**
 * 편집 문서 상태 → 저장 요청 페이로드(spec §6.2) 순수 변환.
 * `focusType='industry'`면 `focusSecurityId`를 항상 null로 강제한다(방어 — 서버도 재검증, R-14와 대칭).
 * 그룹/노드/엣지는 Record 삽입 순서(JS 객체 키 순서)를 그대로 유지해 결정적으로 직렬화한다.
 */
export function serializeSavePayload(state: ChainEditorState): SaveChainRequest {
  return {
    name: state.name.trim(),
    focusType: state.focusType,
    focusSecurityId: state.focusType === "industry" ? null : (state.focusSecurity?.securityId ?? null),
    baseSnapshotId: state.baseSnapshotId,
    groups: Object.values(state.groups).map((group) => ({
      clientGroupId: group.clientGroupId,
      name: group.name,
    })),
    nodes: Object.values(state.nodes).map((node) =>
      node.nodeKind === "listed_company"
        ? {
            clientNodeId: node.clientNodeId,
            nodeKind: "listed_company" as const,
            securityId: node.security.securityId,
            subjectName: null,
            subjectType: null,
            subjectMemo: null,
            groupClientId: node.groupClientId,
            positionX: node.position.x,
            positionY: node.position.y,
          }
        : {
            clientNodeId: node.clientNodeId,
            nodeKind: "free_subject" as const,
            securityId: null,
            subjectName: node.subjectName,
            subjectType: node.subjectType,
            subjectMemo: node.subjectMemo,
            groupClientId: node.groupClientId,
            positionX: node.position.x,
            positionY: node.position.y,
          },
    ),
    edges: Object.values(state.edges).map((edge) => ({
      clientEdgeId: edge.clientEdgeId,
      sourceClientNodeId: edge.sourceClientNodeId,
      targetClientNodeId: edge.targetClientNodeId,
      relationTypeId: edge.relationTypeId,
    })),
  };
}

export interface IssueHighlight {
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
  groupIds: ReadonlySet<string>;
  nameError: string | null;
}

/**
 * `state.serverIssues` + 클라이언트 이슈(`ClientIssue`와 구조 호환되는 `ServerIssue[]`)를
 * nodeIds/edgeIds/groupIds Set + nameError로 합산한다(state_management.md §4.4).
 * 캔버스 하이라이트(`selectReactFlowNodes`/`selectReactFlowEdges`)의 입력으로 사용된다.
 */
export function selectIssueHighlight(
  state: ChainEditorState,
  clientIssues: ReadonlyArray<ServerIssue>,
): IssueHighlight {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const groupIds = new Set<string>();
  let nameError: string | null = null;

  for (const issue of [...state.serverIssues, ...clientIssues]) {
    for (const id of issue.targets.clientNodeIds ?? []) {
      nodeIds.add(id);
    }
    for (const id of issue.targets.clientEdgeIds ?? []) {
      edgeIds.add(id);
    }
    for (const id of issue.targets.clientGroupIds ?? []) {
      groupIds.add(id);
    }
    if (issue.targets.field === "name") {
      nameError = issue.message;
    }
  }

  return { nodeIds, edgeIds, groupIds, nameError };
}
