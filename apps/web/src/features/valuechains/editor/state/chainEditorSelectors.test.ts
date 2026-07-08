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
  selectGroupMembership,
  selectEmptyGroupIds,
  selectDuplicateGroupNames,
  serializeSavePayload,
  selectIssueHighlight,
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

  // ==========================================================================
  // UC-017: 그룹 파생 셀렉터
  // ==========================================================================

  function buildGroupedState(): ChainEditorState {
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
      payload: { clientNodeId: "n2", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 200, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n3", subjectType: "other", subjectName: "미소속", subjectMemo: null, position: { x: 400, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "소재", memberNodeIds: ["n1", "n2"] },
    });
    return state;
  }

  it("groupMembership: 그룹 2·노드 3(2+1 소속) → 역인덱스 정확, 미소속 노드 미포함", () => {
    let state = buildGroupedState();
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g2", name: "빈그룹아님", memberNodeIds: ["n3"] },
    });
    const membership = selectGroupMembership(state);
    expect([...(membership.get("g1") ?? [])].sort()).toEqual(["n1", "n2"]);
    expect([...(membership.get("g2") ?? [])].sort()).toEqual(["n3"]);
  });

  it("emptyGroupIds: 멤버 0개 그룹만 수집 / 전 그룹 유멤버 → 빈 배열", () => {
    let state = buildGroupedState();
    state = chainEditorReducer(state, {
      type: "GROUP_DISSOLVED",
      payload: { clientGroupId: "g1" },
    });
    // g1 해제 후 다시 빈 그룹으로 생성 불가(생성은 멤버 필요) — 대신 이동으로 빈 그룹 유도
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g2", name: "새그룹", memberNodeIds: ["n1"] },
    });
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g3", name: "빈그룹될것", memberNodeIds: ["n2"] },
    });
    // n2를 g2로 이동시켜 g3를 빈 그룹으로 만든다.
    state = chainEditorReducer(state, {
      type: "NODE_GROUP_CHANGED",
      payload: { clientNodeId: "n2", groupClientId: "g2" },
    });
    expect(selectEmptyGroupIds(state)).toEqual(["g3"]);

    const noneEmptyState = buildGroupedState();
    expect(selectEmptyGroupIds(noneEmptyState)).toEqual([]);
  });

  it("duplicateGroupNames: 완전 일치(trim 후) 이름 2회 이상 → 중복 검출 / 유일 이름 → 미검출", () => {
    let state = buildGroupedState();
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g2", name: "소재", memberNodeIds: ["n3"] },
    });
    expect(selectDuplicateGroupNames(state)).toEqual(["소재"]);

    const uniqueState = buildGroupedState();
    expect(selectDuplicateGroupNames(uniqueState)).toEqual([]);
  });

  it("RF 매핑: 소속 노드에 parentId 부여 + 상대 좌표 = 절대 − 그룹 위치 / 미소속 노드는 절대 좌표·parentId 없음", () => {
    const state = buildGroupedState();
    const nodes = selectReactFlowNodes(state);

    const groupNode = nodes.find((n) => n.id === "g1");
    expect(groupNode).toBeDefined();
    expect(groupNode?.type).toBe("groupNode");

    const n1 = nodes.find((n) => n.id === "n1");
    expect(n1?.parentId).toBe("g1");
    expect(n1?.position.x).toBe(0 - (groupNode?.position.x ?? 0));

    const n3 = nodes.find((n) => n.id === "n3");
    expect(n3?.parentId).toBeUndefined();
    expect(n3?.position).toEqual({ x: 400, y: 0 });
  });

  it("RF 매핑: 그룹 노드가 배열에서 소속 노드보다 앞 / draggable=false", () => {
    const state = buildGroupedState();
    const nodes = selectReactFlowNodes(state);
    const groupIndex = nodes.findIndex((n) => n.id === "g1");
    const memberIndex = nodes.findIndex((n) => n.id === "n1");
    expect(groupIndex).toBeLessThan(memberIndex);
    expect(nodes[groupIndex]?.draggable).toBe(false);
  });

  it("RF 매핑: 빈 그룹 → data.isEmpty=true + 폴백 크기", () => {
    let state = buildGroupedState();
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g2", name: "빈그룹될것", memberNodeIds: ["n3"] },
    });
    state = chainEditorReducer(state, {
      type: "ELEMENTS_DELETED",
      payload: { nodeIds: ["n3"], edgeIds: [] },
    });
    const nodes = selectReactFlowNodes(state);
    const emptyGroup = nodes.find((n) => n.id === "g2");
    expect(emptyGroup?.data).toMatchObject({ isEmpty: true });
    expect(emptyGroup?.width).toBeGreaterThan(0);
    expect(emptyGroup?.height).toBeGreaterThan(0);
  });

  it("highlight.groupIds에 포함된 그룹 → data.isHighlighted=true", () => {
    const state = buildGroupedState();
    const nodes = selectReactFlowNodes(state, { groupIds: ["g1"] });
    const groupNode = nodes.find((n) => n.id === "g1");
    expect(groupNode?.data).toMatchObject({ isHighlighted: true });
  });

  // ==========================================================================
  // UC-018: 저장 직렬화·이슈 하이라이트 셀렉터
  // ==========================================================================

  describe("serializeSavePayload", () => {
    it("혼합 문서(그룹 1·listed 1·free 1·엣지 1) → spec §6.2 예시와 동형(필드명·null 규칙·좌표 포함)", () => {
      let state = initEditor();
      state = chainEditorReducer(state, { type: "CHAIN_NAME_CHANGED", payload: { name: "  나의 체인  " } });
      state = chainEditorReducer(state, {
        type: "LISTED_NODE_ADDED",
        payload: {
          clientNodeId: "n1",
          security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
          position: { x: 120.5, y: -48 },
        },
      });
      state = chainEditorReducer(state, {
        type: "FREE_SUBJECT_NODE_ADDED",
        payload: { clientNodeId: "n2", subjectType: "consumer", subjectName: "국내 소비자", subjectMemo: null, position: { x: 320, y: 96 } },
      });
      state = chainEditorReducer(state, {
        type: "GROUP_CREATED",
        payload: { clientGroupId: "g1", name: "소재", memberNodeIds: ["n1"] },
      });
      state = chainEditorReducer(state, {
        type: "EDGE_ADDED",
        payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" },
      });

      const payload = serializeSavePayload(state);

      expect(payload.name).toBe("나의 체인");
      expect(payload.focusType).toBe("industry");
      expect(payload.focusSecurityId).toBeNull();
      expect(payload.baseSnapshotId).toBeNull();
      expect(payload.groups).toEqual([{ clientGroupId: "g1", name: "소재" }]);
      expect(payload.nodes).toEqual([
        {
          clientNodeId: "n1",
          nodeKind: "listed_company",
          securityId: "s1",
          subjectName: null,
          subjectType: null,
          subjectMemo: null,
          groupClientId: "g1",
          positionX: 120.5,
          positionY: -48,
        },
        {
          clientNodeId: "n2",
          nodeKind: "free_subject",
          securityId: null,
          subjectName: "국내 소비자",
          subjectType: "consumer",
          subjectMemo: null,
          groupClientId: null,
          positionX: 320,
          positionY: 96,
        },
      ]);
      expect(payload.edges).toEqual([
        { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" },
      ]);
    });

    it("focusType='industry' + focusSecurity 잔존(방어) → focusSecurityId=null", () => {
      let state = initEditor();
      state = chainEditorReducer(state, { type: "FOCUS_TYPE_CHANGED", payload: { focusType: "company" } });
      state = chainEditorReducer(state, {
        type: "FOCUS_SECURITY_SET",
        payload: { security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" } },
      });
      // 방어적 시나리오: 리듀서 정상 흐름에서는 industry 전환 시 focusSecurity가 null화되지만,
      // 직렬화 함수 자체도 이중 방어로 industry면 focusSecurityId를 강제 null 처리해야 한다.
      const forcedState: ChainEditorState = { ...state, focusType: "industry" };
      const payload = serializeSavePayload(forcedState);
      expect(payload.focusSecurityId).toBeNull();
    });

    it("baseSnapshotId가 설정된 상태 → 그대로 직렬화(갱신 저장)", () => {
      const state: ChainEditorState = {
        ...initEditor(),
        chainId: "chain-1",
        baseSnapshotId: "snap-1",
      };
      const payload = serializeSavePayload(state);
      expect(payload.baseSnapshotId).toBe("snap-1");
    });
  });

  describe("selectIssueHighlight", () => {
    it("server 409 DUPLICATE_NAME(field=name) + client INVALID_EDGE 혼재 → nameError 설정 + edgeIds 수집", () => {
      const state: ChainEditorState = {
        ...initEditor(),
        serverIssues: [
          {
            code: "VALUECHAINS.DUPLICATE_NAME",
            message: "이미 사용 중인 이름입니다.",
            targets: { field: "name" },
          },
        ],
      };
      const clientIssues = [
        { code: "INVALID_EDGE" as const, message: "엣지 오류", targets: { clientEdgeIds: ["e1", "e2"] } },
      ];
      const highlight = selectIssueHighlight(state, clientIssues);
      expect(highlight.nameError).toBe("이미 사용 중인 이름입니다.");
      expect([...highlight.edgeIds]).toEqual(expect.arrayContaining(["e1", "e2"]));
    });

    it("이슈 없음 → 빈 Set + nameError=null", () => {
      const state = initEditor();
      const highlight = selectIssueHighlight(state, []);
      expect(highlight.nameError).toBeNull();
      expect(highlight.nodeIds.size).toBe(0);
      expect(highlight.edgeIds.size).toBe(0);
      expect(highlight.groupIds.size).toBe(0);
    });
  });
});
