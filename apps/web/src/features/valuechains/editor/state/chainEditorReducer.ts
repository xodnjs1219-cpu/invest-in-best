import type {
  EditorNode,
  EditorEdge,
  EditorGroup,
  EditorSelection,
  FocusType,
  FreeSubjectType,
  SecurityRef,
  ServerIssue,
  XYPosition,
} from "@iib/domain";

/**
 * chain-editor Flux 코어 (UC-013 plan 모듈 5, state_management.md §2.2·§3·§4).
 * 순수 모듈 — I/O·`crypto.randomUUID()`·라우팅 호출 금지, 불변 갱신만 수행한다.
 * 본 파일은 UC-013(신규 생성) 분량의 전이(수명주기·메타)만 구현하고,
 * 노드/엣지/그룹/저장 관련 전이는 UC-015~018 plan이 이 파일의 `switch` 문에 case를 추가한다
 * (Action union·State 타입은 이미 전체를 선언 — 후속 plan은 케이스만 채운다).
 */

// ============================================================================
// State (S1~S12 — state_management.md §2.2)
// ============================================================================

export interface ChainEditorState {
  /** S1 — 초기 로드 완료 전 편집 액션 차단 게이트. */
  initialized: boolean;
  /** S2 — create는 신규 저장 성공 시 채워짐. */
  chainId: string | null;
  /** S3 — 낙관적 잠금 기준(UC-018 BR-7). */
  baseSnapshotId: string | null;
  /** S4. */
  name: string;
  /** S5. */
  focusType: FocusType;
  /** S6. */
  focusSecurity: SecurityRef | null;
  /** S7 — key = clientNodeId. */
  nodes: Record<string, EditorNode>;
  /** S8 — key = clientEdgeId. */
  edges: Record<string, EditorEdge>;
  /** S9 — key = clientGroupId. */
  groups: Record<string, EditorGroup>;
  /** S10 — 휘발 UI 상태(저장 대상 아님). */
  selection: EditorSelection;
  /** S11. */
  isDirty: boolean;
  /** S12. */
  serverIssues: ServerIssue[];
}

export const CHAIN_EDITOR_INITIAL_STATE: ChainEditorState = {
  initialized: false,
  chainId: null,
  baseSnapshotId: null,
  name: "",
  focusType: "industry",
  focusSecurity: null,
  nodes: {},
  edges: {},
  groups: {},
  selection: { nodeIds: [], edgeIds: [] },
  isDirty: false,
  serverIssues: [],
};

// ============================================================================
// Action (§3 — 전체 union, 케이스 구현은 UC별로 점진 확장)
// ============================================================================

/** EDITOR_INITIALIZED payload — 스냅샷 DTO를 편집 도메인 모델로 1회 변환한 결과. */
export interface EditorBootstrap {
  /** create=null, edit/복제 직후=대상 체인. */
  chainId: string | null;
  /** create=null, edit=로드한 최신 스냅샷 ID. */
  baseSnapshotId: string | null;
  name: string;
  focusType: FocusType;
  focusSecurity: SecurityRef | null;
  /** 서버 노드 id를 clientNodeId로 승계. */
  nodes: Record<string, EditorNode>;
  edges: Record<string, EditorEdge>;
  groups: Record<string, EditorGroup>;
}

export type ChainEditorAction =
  // ── 수명주기 ─────────────────────────────────────────
  | { type: "EDITOR_INITIALIZED"; payload: EditorBootstrap }
  // ── 메타 (UC-013) ───────────────────────────────────
  | { type: "CHAIN_NAME_CHANGED"; payload: { name: string } }
  | { type: "FOCUS_TYPE_CHANGED"; payload: { focusType: FocusType } }
  | { type: "FOCUS_SECURITY_SET"; payload: { security: SecurityRef } }
  | { type: "FOCUS_SECURITY_CLEARED" }
  // ── 노드 (UC-015) ───────────────────────────────────
  | {
      type: "LISTED_NODE_ADDED";
      payload: { clientNodeId: string; security: SecurityRef; position: XYPosition };
    }
  | {
      type: "FREE_SUBJECT_NODE_ADDED";
      payload: {
        clientNodeId: string;
        subjectType: FreeSubjectType;
        subjectName: string;
        subjectMemo: string | null;
        position: XYPosition;
      };
    }
  | { type: "NODE_MOVED"; payload: { clientNodeId: string; position: XYPosition } }
  | { type: "ELEMENTS_DELETED"; payload: { nodeIds: string[]; edgeIds: string[] } }
  // ── 엣지 (UC-016) ───────────────────────────────────
  | {
      type: "EDGE_ADDED";
      payload: {
        clientEdgeId: string;
        sourceClientNodeId: string;
        targetClientNodeId: string;
        relationTypeId: string;
      };
    }
  | { type: "EDGE_RELATION_CHANGED"; payload: { clientEdgeId: string; relationTypeId: string } }
  // ── 그룹 (UC-017) ───────────────────────────────────
  | {
      type: "GROUP_CREATED";
      payload: { clientGroupId: string; name: string; memberNodeIds: string[] };
    }
  | { type: "GROUP_RENAMED"; payload: { clientGroupId: string; name: string } }
  | { type: "NODE_GROUP_CHANGED"; payload: { clientNodeId: string; groupClientId: string | null } }
  | { type: "GROUP_DISSOLVED"; payload: { clientGroupId: string } }
  // ── 선택 (문서 비변형) ────────────────────────────────
  | { type: "SELECTION_CHANGED"; payload: EditorSelection }
  // ── 저장 수명주기 (UC-018) ────────────────────────────
  | { type: "SAVE_SUCCEEDED"; payload: { chainId: string; snapshotId: string } }
  | { type: "SAVE_REJECTED"; payload: { issues: ServerIssue[] } };

// ============================================================================
// Reducer (§4 — 순수 함수)
// ============================================================================

/** 문서 변형 공통 후처리(⊕) — 실제 변경이 있을 때만 적용, 없으면 원본 반환. */
function withDirty(state: ChainEditorState): ChainEditorState {
  return { ...state, isDirty: true, serverIssues: [] };
}

/** 두 selection이 (순서 포함) 동일한지 — SELECTION_CHANGED의 no-op 판정용. */
function isSameSelection(a: EditorSelection, b: EditorSelection): boolean {
  return (
    a.nodeIds.length === b.nodeIds.length &&
    a.edgeIds.length === b.edgeIds.length &&
    a.nodeIds.every((id, i) => id === b.nodeIds[i]) &&
    a.edgeIds.every((id, i) => id === b.edgeIds[i])
  );
}

/**
 * 순수 함수 — 사이드이펙트 금지, 불변 갱신(새 객체 반환).
 * 초기화 게이트: `initialized=false`인 동안 `EDITOR_INITIALIZED` 외 모든 액션은 무시(no-op).
 */
export function chainEditorReducer(
  state: ChainEditorState,
  action: ChainEditorAction,
): ChainEditorState {
  if (!state.initialized && action.type !== "EDITOR_INITIALIZED") {
    return state;
  }

  switch (action.type) {
    case "EDITOR_INITIALIZED": {
      const { payload } = action;
      return {
        ...state,
        chainId: payload.chainId,
        baseSnapshotId: payload.baseSnapshotId,
        name: payload.name,
        focusType: payload.focusType,
        focusSecurity: payload.focusSecurity,
        nodes: payload.nodes,
        edges: payload.edges,
        groups: payload.groups,
        initialized: true,
        selection: { nodeIds: [], edgeIds: [] },
        isDirty: false,
        serverIssues: [],
      };
    }

    case "CHAIN_NAME_CHANGED": {
      if (state.name === action.payload.name) {
        return state;
      }
      return withDirty({ ...state, name: action.payload.name });
    }

    case "FOCUS_TYPE_CHANGED": {
      if (state.focusType === action.payload.focusType) {
        return state;
      }
      const focusSecurity = action.payload.focusType === "industry" ? null : state.focusSecurity;
      return withDirty({ ...state, focusType: action.payload.focusType, focusSecurity });
    }

    case "FOCUS_SECURITY_SET": {
      if (state.focusType !== "company") {
        return state; // no-op 가드
      }
      return withDirty({ ...state, focusSecurity: action.payload.security });
    }

    case "FOCUS_SECURITY_CLEARED": {
      if (state.focusSecurity === null) {
        return state;
      }
      return withDirty({ ...state, focusSecurity: null });
    }

    case "SELECTION_CHANGED": {
      // 선택이 실제로 바뀌지 않았으면 기존 state를 그대로 반환한다(참조 안정성).
      // React Flow는 새 nodes/edges prop을 받을 때마다 onSelectionChange를 호출하므로,
      // 항상 새 state 객체를 반환하면 재렌더 → 새 selector 배열 → 재선택 통지로 무한 루프가 된다.
      if (isSameSelection(state.selection, action.payload)) {
        return state;
      }
      return { ...state, selection: action.payload };
    }

    case "SAVE_SUCCEEDED": {
      return {
        ...state,
        chainId: action.payload.chainId,
        baseSnapshotId: action.payload.snapshotId,
        isDirty: false,
        serverIssues: [],
      };
    }

    case "SAVE_REJECTED": {
      return { ...state, serverIssues: action.payload.issues };
    }

    // ── 노드 (UC-015) ───────────────────────────────────
    case "LISTED_NODE_ADDED": {
      const { clientNodeId, security, position } = action.payload;
      return withDirty({
        ...state,
        nodes: {
          ...state.nodes,
          [clientNodeId]: {
            clientNodeId,
            nodeKind: "listed_company",
            security,
            groupClientId: null,
            position,
          },
        },
      });
    }

    case "FREE_SUBJECT_NODE_ADDED": {
      const { clientNodeId, subjectType, subjectName, subjectMemo, position } = action.payload;
      return withDirty({
        ...state,
        nodes: {
          ...state.nodes,
          [clientNodeId]: {
            clientNodeId,
            nodeKind: "free_subject",
            subjectType,
            subjectName,
            subjectMemo,
            groupClientId: null,
            position,
          },
        },
      });
    }

    case "NODE_MOVED": {
      const { clientNodeId, position } = action.payload;
      const existing = state.nodes[clientNodeId];
      if (!existing) {
        return state; // no-op 가드(E10)
      }
      return withDirty({
        ...state,
        nodes: { ...state.nodes, [clientNodeId]: { ...existing, position } },
      });
    }

    case "ELEMENTS_DELETED": {
      const { nodeIds, edgeIds } = action.payload;
      const nodeIdSet = new Set(nodeIds);
      const explicitEdgeIdSet = new Set(edgeIds);

      const hasExistingNode = nodeIds.some((id) => state.nodes[id] !== undefined);
      const hasExistingEdge = edgeIds.some((id) => state.edges[id] !== undefined);
      if (!hasExistingNode && !hasExistingEdge) {
        return state; // no-op 가드(E10) — 전부 미존재
      }

      const nextNodes = { ...state.nodes };
      for (const nodeId of nodeIds) {
        delete nextNodes[nodeId];
      }

      const nextEdges = { ...state.edges };
      for (const [edgeId, edge] of Object.entries(state.edges)) {
        const connectedToDeletedNode =
          nodeIdSet.has(edge.sourceClientNodeId) || nodeIdSet.has(edge.targetClientNodeId);
        if (explicitEdgeIdSet.has(edgeId) || connectedToDeletedNode) {
          delete nextEdges[edgeId];
        }
      }

      const nextSelection: EditorSelection = {
        nodeIds: state.selection.nodeIds.filter((id) => !nodeIdSet.has(id)),
        edgeIds: state.selection.edgeIds.filter(
          (id) => nextEdges[id] !== undefined,
        ),
      };

      return withDirty({
        ...state,
        nodes: nextNodes,
        edges: nextEdges,
        selection: nextSelection,
      });
    }

    // ── 엣지 (UC-016) ───────────────────────────────────
    case "EDGE_ADDED": {
      const { clientEdgeId, sourceClientNodeId, targetClientNodeId, relationTypeId } = action.payload;
      return withDirty({
        ...state,
        edges: {
          ...state.edges,
          [clientEdgeId]: { clientEdgeId, sourceClientNodeId, targetClientNodeId, relationTypeId },
        },
      });
    }

    case "EDGE_RELATION_CHANGED": {
      const { clientEdgeId, relationTypeId } = action.payload;
      const existing = state.edges[clientEdgeId];
      if (!existing) {
        return state; // no-op 가드(E10)
      }
      return withDirty({
        ...state,
        edges: { ...state.edges, [clientEdgeId]: { ...existing, relationTypeId } },
      });
    }

    // ── 그룹 (UC-017) ───────────────────────────────────
    case "GROUP_CREATED": {
      const { clientGroupId, name, memberNodeIds } = action.payload;
      if (state.groups[clientGroupId]) {
        return state; // no-op 가드 — 중복 생성 방어
      }
      const validMemberIds = memberNodeIds.filter((id) => state.nodes[id] !== undefined);
      if (validMemberIds.length === 0) {
        return state; // no-op 가드 — 유효 멤버 0개(액션 함수 검증의 이중 방어)
      }

      const nextNodes = { ...state.nodes };
      for (const nodeId of validMemberIds) {
        const existing = nextNodes[nodeId]!;
        nextNodes[nodeId] = { ...existing, groupClientId: clientGroupId } as typeof existing;
      }

      return withDirty({
        ...state,
        groups: { ...state.groups, [clientGroupId]: { clientGroupId, name } },
        nodes: nextNodes,
      });
    }

    case "GROUP_RENAMED": {
      const { clientGroupId, name } = action.payload;
      const existing = state.groups[clientGroupId];
      if (!existing) {
        return state; // no-op 가드
      }
      if (existing.name === name) {
        return state; // 동일 이름 재입력 — dirty 미발생
      }
      return withDirty({
        ...state,
        groups: { ...state.groups, [clientGroupId]: { ...existing, name } },
      });
    }

    case "NODE_GROUP_CHANGED": {
      const { clientNodeId, groupClientId } = action.payload;
      const existingNode = state.nodes[clientNodeId];
      if (!existingNode) {
        return state; // no-op 가드(E10)
      }
      if (groupClientId !== null && !state.groups[groupClientId]) {
        return state; // no-op 가드 — 미존재 그룹 참조 방어
      }
      if (existingNode.groupClientId === groupClientId) {
        return state; // 동일 소속 재지정 — dirty 미발생
      }
      return withDirty({
        ...state,
        nodes: { ...state.nodes, [clientNodeId]: { ...existingNode, groupClientId } as typeof existingNode },
      });
    }

    case "GROUP_DISSOLVED": {
      const { clientGroupId } = action.payload;
      if (!state.groups[clientGroupId]) {
        return state; // no-op 가드
      }
      const nextGroups = { ...state.groups };
      delete nextGroups[clientGroupId];

      const nextNodes = { ...state.nodes };
      for (const [nodeId, node] of Object.entries(state.nodes)) {
        if (node.groupClientId === clientGroupId) {
          nextNodes[nodeId] = { ...node, groupClientId: null } as typeof node;
        }
      }

      return withDirty({ ...state, groups: nextGroups, nodes: nextNodes });
    }

    default:
      return state;
  }
}
