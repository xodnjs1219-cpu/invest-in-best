import { describe, expect, it } from "vitest";
import type { RelationType } from "@iib/domain";
import { MAX_NODES_PER_CHAIN, NODE_LIMIT_WARNING_THRESHOLD } from "@iib/domain";
import { CHAIN_EDITOR_INITIAL_STATE, chainEditorReducer, type ChainEditorState } from "./chainEditorReducer";
import {
  selectNameIssue,
  selectNodeCount,
  selectRemainingNodeCapacity,
  selectIsNearNodeLimit,
  selectUsedSecurityIds,
  selectConnectedEdgeIds,
  selectReactFlowEdges,
  selectReactFlowNodes,
} from "./chainEditorSelectors";

describe("chainEditorSelectors", () => {
  it("빈 문서 → selectNodeCount=0", () => {
    expect(selectNodeCount(CHAIN_EDITOR_INITIAL_STATE)).toBe(0);
  });

  it("name='' → selectNameIssue='NAME_REQUIRED', name='ABC' → null", () => {
    const emptyName = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: {
        chainId: null,
        baseSnapshotId: null,
        name: "",
        focusType: "industry",
        focusSecurity: null,
        nodes: {},
        edges: {},
        groups: {},
      },
    });
    expect(selectNameIssue(emptyName)).toBe("NAME_REQUIRED");

    const withName = chainEditorReducer(emptyName, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "ABC" },
    });
    expect(selectNameIssue(withName)).toBeNull();
  });

  // ==========================================================================
  // UC-015: 노드 상한/중복 파생 셀렉터
  // ==========================================================================

  function initEditor(): ChainEditorState {
    return chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: {
        chainId: null,
        baseSnapshotId: null,
        name: "",
        focusType: "industry",
        focusSecurity: null,
        nodes: {},
        edges: {},
        groups: {},
      },
    });
  }

  function addNNodes(state: ChainEditorState, count: number): ChainEditorState {
    let next = state;
    for (let i = 0; i < count; i += 1) {
      next = chainEditorReducer(next, {
        type: "FREE_SUBJECT_NODE_ADDED",
        payload: {
          clientNodeId: `n${i}`,
          subjectType: "other",
          subjectName: `s${i}`,
          subjectMemo: null,
          position: { x: 0, y: 0 },
        },
      });
    }
    return next;
  }

  it(`노드 ${NODE_LIMIT_WARNING_THRESHOLD}개 → isNearNodeLimit=true, ${NODE_LIMIT_WARNING_THRESHOLD - 1}개 → false(경계값)`, () => {
    const below = addNNodes(initEditor(), NODE_LIMIT_WARNING_THRESHOLD - 1);
    expect(selectIsNearNodeLimit(below)).toBe(false);

    const at = addNNodes(initEditor(), NODE_LIMIT_WARNING_THRESHOLD);
    expect(selectIsNearNodeLimit(at)).toBe(true);
  });

  it(`remainingNodeCapacity: ${MAX_NODES_PER_CHAIN}개 → 0, 초과해도 음수 미반환`, () => {
    const atLimit = addNNodes(initEditor(), MAX_NODES_PER_CHAIN);
    expect(selectRemainingNodeCapacity(atLimit)).toBe(0);
  });

  it("usedSecurityIds: free_subject 노드 제외, listed_company만 수집", () => {
    let state = initEditor();
    state = chainEditorReducer(state, {
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n1",
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
        position: { x: 0, y: 0 },
      },
    });
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n2", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    const usedIds = selectUsedSecurityIds(state);
    expect(usedIds.has("s1")).toBe(true);
    expect(usedIds.size).toBe(1);
  });

  it("connectedEdgeIds: source/target 어느 쪽이든 매칭, 무관 엣지 미포함, 중복 없음", () => {
    let state = initEditor();
    state = chainEditorReducer(state, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" },
    });
    state = chainEditorReducer(state, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e2", sourceClientNodeId: "n2", targetClientNodeId: "n3", relationTypeId: "rt1" },
    });
    state = chainEditorReducer(state, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e3", sourceClientNodeId: "n4", targetClientNodeId: "n5", relationTypeId: "rt1" },
    });
    const connected = selectConnectedEdgeIds(state, ["n1", "n2"]);
    expect(new Set(connected)).toEqual(new Set(["e1", "e2"]));
  });

  // ==========================================================================
  // UC-016: 엣지 React Flow 매핑 셀렉터
  // ==========================================================================

  const supplyType: RelationType = { id: "rt-supply", name: "공급", isDirected: true, isActive: true };
  const competeType: RelationType = { id: "rt-compete", name: "경쟁", isDirected: false, isActive: true };
  const relationTypeById = new Map<string, RelationType>([
    [supplyType.id, supplyType],
    [competeType.id, competeType],
  ]);

  it("유향 종류 엣지 → markerEnd 설정, 무향 → 마커 없음", () => {
    let state = initEditor();
    state = chainEditorReducer(state, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: supplyType.id },
    });
    state = chainEditorReducer(state, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e2", sourceClientNodeId: "n2", targetClientNodeId: "n3", relationTypeId: competeType.id },
    });
    const edges = selectReactFlowEdges(state, relationTypeById, { edgeIds: [] });
    const directed = edges.find((e) => e.id === "e1");
    const undirected = edges.find((e) => e.id === "e2");
    expect(directed?.markerEnd).toBeDefined();
    expect(undirected?.markerEnd).toBeUndefined();
  });

  it("라벨 = 마스터 최신 name", () => {
    const state = chainEditorReducer(initEditor(), {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: supplyType.id },
    });
    const edges = selectReactFlowEdges(state, relationTypeById, { edgeIds: [] });
    expect(edges[0]?.data?.label).toBe("공급");
  });

  it("마스터에 없는 relationTypeId → 폴백 라벨, throw 없음", () => {
    const state = chainEditorReducer(initEditor(), {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "missing" },
    });
    expect(() => selectReactFlowEdges(state, relationTypeById, { edgeIds: [] })).not.toThrow();
    const edges = selectReactFlowEdges(state, relationTypeById, { edgeIds: [] });
    expect(edges[0]?.data?.label).toBeTruthy();
  });

  it("highlight.edgeIds에 포함된 엣지 → isHighlighted=true", () => {
    const state = chainEditorReducer(initEditor(), {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: supplyType.id },
    });
    const edges = selectReactFlowEdges(state, relationTypeById, { edgeIds: ["e1"] });
    expect(edges[0]?.data?.isHighlighted).toBe(true);
  });

  // ==========================================================================
  // UC-015: 노드 React Flow 매핑 셀렉터
  // ==========================================================================

  it("selectReactFlowNodes: listed_company 노드 → CompanyNode 타입 + 라벨/시장 매핑", () => {
    const state = chainEditorReducer(initEditor(), {
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n1",
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
        position: { x: 10, y: 20 },
      },
    });
    const nodes = selectReactFlowNodes(state);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: "n1",
      type: "companyNode",
      position: { x: 10, y: 20 },
      data: { label: "삼성전자", sublabel: "005930", market: "KRX" },
    });
  });

  it("selectReactFlowNodes: free_subject 노드 → FreeSubjectNode 타입 + 주체 유형 매핑", () => {
    const state = chainEditorReducer(initEditor(), {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n2", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    const nodes = selectReactFlowNodes(state);
    expect(nodes[0]).toMatchObject({
      id: "n2",
      type: "freeSubjectNode",
      data: { label: "소비자", subjectType: "consumer" },
    });
  });
});
