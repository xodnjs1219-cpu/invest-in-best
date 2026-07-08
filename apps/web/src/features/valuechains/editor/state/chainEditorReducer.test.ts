import { describe, expect, it } from "vitest";
import type { EditorBootstrap } from "./chainEditorReducer";
import {
  CHAIN_EDITOR_INITIAL_STATE,
  chainEditorReducer,
} from "./chainEditorReducer";

const emptyBootstrap: EditorBootstrap = {
  chainId: null,
  baseSnapshotId: null,
  name: "",
  focusType: "industry",
  focusSecurity: null,
  nodes: {},
  edges: {},
  groups: {},
};

describe("chainEditorReducer", () => {
  it("initialized=false 상태에서 CHAIN_NAME_CHANGED dispatch → no-op(원본 참조 동일 반환)", () => {
    const state = CHAIN_EDITOR_INITIAL_STATE;
    const next = chainEditorReducer(state, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "AI 반도체" },
    });
    expect(next).toBe(state);
  });

  it("create 부트스트랩 payload(빈 문서)로 EDITOR_INITIALIZED → initialized=true, chainId=null, baseSnapshotId=null, isDirty=false", () => {
    const next = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    expect(next.initialized).toBe(true);
    expect(next.chainId).toBeNull();
    expect(next.baseSnapshotId).toBeNull();
    expect(next.isDirty).toBe(false);
    expect(next.serverIssues).toEqual([]);
    expect(next.selection).toEqual({ nodeIds: [], edgeIds: [] });
  });

  it("CHAIN_NAME_CHANGED → name 반영 + isDirty=true + serverIssues=[], 원본 객체 비변이(불변성)", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const next = chainEditorReducer(initialized, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "2차전지 밸류체인" },
    });
    expect(next.name).toBe("2차전지 밸류체인");
    expect(next.isDirty).toBe(true);
    expect(next.serverIssues).toEqual([]);
    expect(initialized.name).toBe(""); // 원본 비변이
  });

  it("focusSecurity 설정 상태에서 FOCUS_TYPE_CHANGED('industry') → focusSecurity=null", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const withCompany = chainEditorReducer(initialized, {
      type: "FOCUS_TYPE_CHANGED",
      payload: { focusType: "company" },
    });
    const withSecurity = chainEditorReducer(withCompany, {
      type: "FOCUS_SECURITY_SET",
      payload: {
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
      },
    });
    expect(withSecurity.focusSecurity).not.toBeNull();

    const backToIndustry = chainEditorReducer(withSecurity, {
      type: "FOCUS_TYPE_CHANGED",
      payload: { focusType: "industry" },
    });
    expect(backToIndustry.focusType).toBe("industry");
    expect(backToIndustry.focusSecurity).toBeNull();
  });

  it("focusType='industry' 상태에서 FOCUS_SECURITY_SET → no-op 가드(상태 불변)", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const next = chainEditorReducer(initialized, {
      type: "FOCUS_SECURITY_SET",
      payload: {
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
      },
    });
    expect(next).toBe(initialized);
    expect(next.focusSecurity).toBeNull();
  });

  it("FOCUS_TYPE_CHANGED('company') 후 FOCUS_SECURITY_SET → focusSecurity 반영 + dirty", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const withCompany = chainEditorReducer(initialized, {
      type: "FOCUS_TYPE_CHANGED",
      payload: { focusType: "company" },
    });
    const security = { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" as const };
    const next = chainEditorReducer(withCompany, {
      type: "FOCUS_SECURITY_SET",
      payload: { security },
    });
    expect(next.focusSecurity).toEqual(security);
    expect(next.isDirty).toBe(true);
  });

  it("FOCUS_SECURITY_CLEARED → focusSecurity=null + dirty", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const withCompany = chainEditorReducer(initialized, {
      type: "FOCUS_TYPE_CHANGED",
      payload: { focusType: "company" },
    });
    const withSecurity = chainEditorReducer(withCompany, {
      type: "FOCUS_SECURITY_SET",
      payload: {
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
      },
    });
    const next = chainEditorReducer(withSecurity, { type: "FOCUS_SECURITY_CLEARED" });
    expect(next.focusSecurity).toBeNull();
    expect(next.isDirty).toBe(true);
  });

  it("동일 값 재입력(name 불변) → 원본 반환(dirty 미발생)", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: { ...emptyBootstrap, name: "AI 반도체" },
    });
    const next = chainEditorReducer(initialized, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "AI 반도체" },
    });
    expect(next).toBe(initialized);
    expect(next.isDirty).toBe(false);
  });

  it("미구현 액션 타입(GROUP_CREATED 등, UC-017 확장 전) dispatch → no-op(안전성)", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const next = chainEditorReducer(initialized, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "소재", memberNodeIds: [] },
    });
    expect(next).toBe(initialized);
  });

  it("SELECTION_CHANGED → isDirty/serverIssues 불변", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const next = chainEditorReducer(initialized, {
      type: "SELECTION_CHANGED",
      payload: { nodeIds: ["n1"], edgeIds: [] },
    });
    expect(next.selection).toEqual({ nodeIds: ["n1"], edgeIds: [] });
    expect(next.isDirty).toBe(false);
  });

  it("SAVE_SUCCEEDED → chainId/baseSnapshotId 갱신, isDirty=false", () => {
    const initialized = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
    const dirty = chainEditorReducer(initialized, {
      type: "CHAIN_NAME_CHANGED",
      payload: { name: "AI 반도체" },
    });
    const saved = chainEditorReducer(dirty, {
      type: "SAVE_SUCCEEDED",
      payload: { chainId: "c1", snapshotId: "snap1" },
    });
    expect(saved.chainId).toBe("c1");
    expect(saved.baseSnapshotId).toBe("snap1");
    expect(saved.isDirty).toBe(false);
  });

  // ==========================================================================
  // UC-015: 노드 추가/삭제 전이
  // ==========================================================================

  function initEditor() {
    return chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: emptyBootstrap,
    });
  }

  it("LISTED_NODE_ADDED → nodes에 추가, groupClientId=null, isDirty=true, serverIssues=[], 원본 비변이", () => {
    const initialized = initEditor();
    const next = chainEditorReducer(initialized, {
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n1",
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
        position: { x: 10, y: 20 },
      },
    });
    expect(next.nodes.n1).toEqual({
      clientNodeId: "n1",
      nodeKind: "listed_company",
      security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
      groupClientId: null,
      position: { x: 10, y: 20 },
    });
    expect(next.isDirty).toBe(true);
    expect(next.serverIssues).toEqual([]);
    expect(initialized.nodes.n1).toBeUndefined(); // 원본 비변이
  });

  it("FREE_SUBJECT_NODE_ADDED(memo=null) → 노드 추가 + 동일 후처리", () => {
    const initialized = initEditor();
    const next = chainEditorReducer(initialized, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: {
        clientNodeId: "n2",
        subjectType: "consumer",
        subjectName: "일반 소비자",
        subjectMemo: null,
        position: { x: 0, y: 0 },
      },
    });
    expect(next.nodes.n2).toEqual({
      clientNodeId: "n2",
      nodeKind: "free_subject",
      subjectType: "consumer",
      subjectName: "일반 소비자",
      subjectMemo: null,
      groupClientId: null,
      position: { x: 0, y: 0 },
    });
    expect(next.isDirty).toBe(true);
  });

  it("NODE_MOVED → 해당 노드 position만 갱신", () => {
    const withNode = chainEditorReducer(initEditor(), {
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n1",
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
        position: { x: 0, y: 0 },
      },
    });
    const next = chainEditorReducer(withNode, {
      type: "NODE_MOVED",
      payload: { clientNodeId: "n1", position: { x: 99, y: 88 } },
    });
    expect(next.nodes.n1.position).toEqual({ x: 99, y: 88 });
  });

  it("NODE_MOVED: 미존재 clientNodeId → no-op(멱등, E10)", () => {
    const initialized = initEditor();
    const next = chainEditorReducer(initialized, {
      type: "NODE_MOVED",
      payload: { clientNodeId: "missing", position: { x: 1, y: 1 } },
    });
    expect(next).toBe(initialized);
  });

  it("ELEMENTS_DELETED(edgeIds만) → 엣지 제거, 노드 불변, selection에서 제외", () => {
    const withNodes = chainEditorReducer(chainEditorReducer(initEditor(), {
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n1",
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
        position: { x: 0, y: 0 },
      },
    }), {
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n2",
        security: { securityId: "s2", ticker: "000660", name: "SK하이닉스", market: "KRX" },
        position: { x: 0, y: 0 },
      },
    });
    const withEdge = chainEditorReducer(withNodes, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" },
    });
    const selected = chainEditorReducer(withEdge, {
      type: "SELECTION_CHANGED",
      payload: { nodeIds: [], edgeIds: ["e1"] },
    });
    const next = chainEditorReducer(selected, {
      type: "ELEMENTS_DELETED",
      payload: { nodeIds: [], edgeIds: ["e1"] },
    });
    expect(next.edges.e1).toBeUndefined();
    expect(next.nodes.n1).toBeDefined();
    expect(next.nodes.n2).toBeDefined();
    expect(next.selection.edgeIds).toEqual([]);
  });

  it("ELEMENTS_DELETED(nodeIds) — 연결 엣지 2건 있는 노드 삭제 → 노드+엣지 연쇄 제거(E5·BR-5)", () => {
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
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n2",
        security: { securityId: "s2", ticker: "000660", name: "SK하이닉스", market: "KRX" },
        position: { x: 0, y: 0 },
      },
    });
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n3", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" },
    });
    state = chainEditorReducer(state, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e2", sourceClientNodeId: "n2", targetClientNodeId: "n3", relationTypeId: "rt1" },
    });

    const next = chainEditorReducer(state, {
      type: "ELEMENTS_DELETED",
      payload: { nodeIds: ["n2"], edgeIds: [] },
    });

    expect(next.nodes.n2).toBeUndefined();
    expect(next.nodes.n1).toBeDefined();
    expect(next.nodes.n3).toBeDefined();
    expect(next.edges.e1).toBeUndefined(); // n2 연결 → 연쇄 제거
    expect(next.edges.e2).toBeUndefined(); // n2 연결 → 연쇄 제거
  });

  it("ELEMENTS_DELETED: 그룹 소속 노드 삭제 → 노드만 제거, groups 레코드는 건드리지 않음(D-5/E8, 그룹 자체 전이는 UC-017 범위)", () => {
    // groups 사전 시딩은 부트스트랩 시점(EDITOR_INITIALIZED)으로 대체 — GROUP_CREATED는 UC-017 미구현 범위.
    const bootstrapWithGroup = {
      ...emptyBootstrap,
      groups: { g1: { clientGroupId: "g1", name: "소재" } },
    };
    let state = chainEditorReducer(CHAIN_EDITOR_INITIAL_STATE, {
      type: "EDITOR_INITIALIZED",
      payload: bootstrapWithGroup,
    });
    state = chainEditorReducer(state, {
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n1",
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
        position: { x: 0, y: 0 },
      },
    });

    const next = chainEditorReducer(state, {
      type: "ELEMENTS_DELETED",
      payload: { nodeIds: ["n1"], edgeIds: [] },
    });

    expect(next.nodes.n1).toBeUndefined();
    expect(next.groups.g1).toBeDefined(); // 빈 그룹 유지(D-5) — groups는 노드 삭제로 변경되지 않음
  });

  it("ELEMENTS_DELETED: 미존재 nodeId만 → no-op(isDirty 불변, E10)", () => {
    const initialized = initEditor();
    const next = chainEditorReducer(initialized, {
      type: "ELEMENTS_DELETED",
      payload: { nodeIds: ["missing"], edgeIds: [] },
    });
    expect(next).toBe(initialized);
  });

  it("ELEMENTS_DELETED: 존재 1 + 미존재 1 혼합 → 존재분만 제거, dirty=true", () => {
    const withNode = chainEditorReducer(initEditor(), {
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n1",
        security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
        position: { x: 0, y: 0 },
      },
    });
    const next = chainEditorReducer(withNode, {
      type: "ELEMENTS_DELETED",
      payload: { nodeIds: ["n1", "missing"], edgeIds: [] },
    });
    expect(next.nodes.n1).toBeUndefined();
    expect(next.isDirty).toBe(true);
  });

  it("ELEMENTS_DELETED: 삭제 대상과 무관한 엣지는 보존", () => {
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
      type: "LISTED_NODE_ADDED",
      payload: {
        clientNodeId: "n2",
        security: { securityId: "s2", ticker: "000660", name: "SK하이닉스", market: "KRX" },
        position: { x: 0, y: 0 },
      },
    });
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n3", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" },
    });

    const next = chainEditorReducer(state, {
      type: "ELEMENTS_DELETED",
      payload: { nodeIds: ["n3"], edgeIds: [] },
    });
    expect(next.edges.e1).toBeDefined();
  });

  // ==========================================================================
  // UC-016: 엣지 설정/편집 전이
  // ==========================================================================

  it("EDGE_ADDED → edges에 추가, isDirty=true, serverIssues 초기화, 원본 비변이", () => {
    const initialized = initEditor();
    const next = chainEditorReducer(initialized, {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" },
    });
    expect(next.edges.e1).toEqual({
      clientEdgeId: "e1",
      sourceClientNodeId: "n1",
      targetClientNodeId: "n2",
      relationTypeId: "rt1",
    });
    expect(next.isDirty).toBe(true);
    expect(next.serverIssues).toEqual([]);
    expect(initialized.edges.e1).toBeUndefined();
  });

  it("EDGE_RELATION_CHANGED → relationTypeId만 갱신", () => {
    const withEdge = chainEditorReducer(initEditor(), {
      type: "EDGE_ADDED",
      payload: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" },
    });
    const next = chainEditorReducer(withEdge, {
      type: "EDGE_RELATION_CHANGED",
      payload: { clientEdgeId: "e1", relationTypeId: "rt2" },
    });
    expect(next.edges.e1.relationTypeId).toBe("rt2");
    expect(next.edges.e1.sourceClientNodeId).toBe("n1");
  });

  it("EDGE_RELATION_CHANGED: 미존재 clientEdgeId → no-op(멱등, isDirty 불변)", () => {
    const initialized = initEditor();
    const next = chainEditorReducer(initialized, {
      type: "EDGE_RELATION_CHANGED",
      payload: { clientEdgeId: "missing", relationTypeId: "rt2" },
    });
    expect(next).toBe(initialized);
  });

  // ==========================================================================
  // UC-017: 그룹 전이
  // ==========================================================================

  it("initialized=false에서 GROUP_CREATED → no-op(013 공통 게이트 회귀)", () => {
    const state = CHAIN_EDITOR_INITIAL_STATE;
    const next = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "소재", memberNodeIds: ["n1"] },
    });
    expect(next).toBe(state);
  });

  it("GROUP_CREATED(미소속 노드 2개) → 그룹 추가 + 두 노드 groupClientId 설정, isDirty=true, serverIssues=[], 원본 비변이", () => {
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
    const before = state;

    const next = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "소재", memberNodeIds: ["n1", "n2"] },
    });
    expect(next.groups.g1).toEqual({ clientGroupId: "g1", name: "소재" });
    expect(next.nodes.n1?.groupClientId).toBe("g1");
    expect(next.nodes.n2?.groupClientId).toBe("g1");
    expect(next.isDirty).toBe(true);
    expect(next.serverIssues).toEqual([]);
    expect(before.groups.g1).toBeUndefined();
  });

  it("GROUP_CREATED(타 그룹 g1 소속 노드 포함) → 해당 노드가 새 그룹으로 자동 이동(E1), g1은 잔존(빈 그룹이어도 유지)", () => {
    let state = initEditor();
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n1", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "그룹1", memberNodeIds: ["n1"] },
    });
    expect(state.nodes.n1?.groupClientId).toBe("g1");

    const next = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g2", name: "그룹2", memberNodeIds: ["n1"] },
    });
    expect(next.nodes.n1?.groupClientId).toBe("g2");
    expect(next.groups.g1).toEqual({ clientGroupId: "g1", name: "그룹1" });
    expect(next.groups.g2).toEqual({ clientGroupId: "g2", name: "그룹2" });
  });

  it("GROUP_CREATED(멤버 전부 미존재 ID) → no-op, dirty 불변", () => {
    const state = initEditor();
    const next = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "소재", memberNodeIds: ["missing"] },
    });
    expect(next).toBe(state);
  });

  it("GROUP_CREATED(기존과 동일 이름) → 정상 생성(중복 허용 — E3)", () => {
    let state = initEditor();
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n1", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n2", subjectType: "consumer", subjectName: "소비자2", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "소재", memberNodeIds: ["n1"] },
    });
    const next = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g2", name: "소재", memberNodeIds: ["n2"] },
    });
    expect(next.groups.g1?.name).toBe("소재");
    expect(next.groups.g2?.name).toBe("소재");
  });

  it("GROUP_RENAMED → 이름만 갱신 / 미존재 그룹 → no-op / 동일 이름 → 원본 반환(dirty 미발생)", () => {
    let state = initEditor();
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n1", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "소재", memberNodeIds: ["n1"] },
    });

    const renamed = chainEditorReducer(state, {
      type: "GROUP_RENAMED",
      payload: { clientGroupId: "g1", name: "새 이름" },
    });
    expect(renamed.groups.g1?.name).toBe("새 이름");

    const noopMissing = chainEditorReducer(state, {
      type: "GROUP_RENAMED",
      payload: { clientGroupId: "missing", name: "새 이름" },
    });
    expect(noopMissing).toBe(state);

    const noopSameName = chainEditorReducer(state, {
      type: "GROUP_RENAMED",
      payload: { clientGroupId: "g1", name: "소재" },
    });
    expect(noopSameName).toBe(state);
  });

  it("NODE_GROUP_CHANGED(g1→g2) → 소속 교체(기존 소속 자동 해제) / (g1→null) → 미소속 전환, 노드·엣지 불변", () => {
    let state = initEditor();
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n1", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n2", subjectType: "consumer", subjectName: "소비자2", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "그룹1", memberNodeIds: ["n1"] },
    });
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g2", name: "그룹2", memberNodeIds: ["n2"] },
    });

    const moved = chainEditorReducer(state, {
      type: "NODE_GROUP_CHANGED",
      payload: { clientNodeId: "n1", groupClientId: "g2" },
    });
    expect(moved.nodes.n1?.groupClientId).toBe("g2");

    const unassigned = chainEditorReducer(state, {
      type: "NODE_GROUP_CHANGED",
      payload: { clientNodeId: "n1", groupClientId: null },
    });
    expect(unassigned.nodes.n1?.groupClientId).toBeNull();
    expect(Object.keys(unassigned.nodes)).toEqual(Object.keys(state.nodes));
  });

  it("NODE_GROUP_CHANGED(미존재 그룹 대상) → no-op / (미존재 노드) → no-op", () => {
    let state = initEditor();
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n1", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });

    const noopMissingGroup = chainEditorReducer(state, {
      type: "NODE_GROUP_CHANGED",
      payload: { clientNodeId: "n1", groupClientId: "missing-group" },
    });
    expect(noopMissingGroup).toBe(state);

    const noopMissingNode = chainEditorReducer(state, {
      type: "NODE_GROUP_CHANGED",
      payload: { clientNodeId: "missing-node", groupClientId: null },
    });
    expect(noopMissingNode).toBe(state);
  });

  it("GROUP_DISSOLVED(멤버 3개 그룹) → 그룹 제거 + 3개 노드 전부 groupClientId=null, 노드·엣지 수 불변(E5)", () => {
    let state = initEditor();
    for (const id of ["n1", "n2", "n3"]) {
      state = chainEditorReducer(state, {
        type: "FREE_SUBJECT_NODE_ADDED",
        payload: { clientNodeId: id, subjectType: "consumer", subjectName: id, subjectMemo: null, position: { x: 0, y: 0 } },
      });
    }
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "그룹1", memberNodeIds: ["n1", "n2", "n3"] },
    });

    const next = chainEditorReducer(state, { type: "GROUP_DISSOLVED", payload: { clientGroupId: "g1" } });
    expect(next.groups.g1).toBeUndefined();
    expect(next.nodes.n1?.groupClientId).toBeNull();
    expect(next.nodes.n2?.groupClientId).toBeNull();
    expect(next.nodes.n3?.groupClientId).toBeNull();
    expect(Object.keys(next.nodes)).toHaveLength(3);
  });

  it("GROUP_DISSOLVED: 미존재 그룹 → no-op", () => {
    const state = initEditor();
    const next = chainEditorReducer(state, { type: "GROUP_DISSOLVED", payload: { clientGroupId: "missing" } });
    expect(next).toBe(state);
  });

  it("ELEMENTS_DELETED로 그룹의 마지막 멤버 삭제 → 그룹 잔존(빈 그룹 유지 — D-5·E9)", () => {
    let state = initEditor();
    state = chainEditorReducer(state, {
      type: "FREE_SUBJECT_NODE_ADDED",
      payload: { clientNodeId: "n1", subjectType: "consumer", subjectName: "소비자", subjectMemo: null, position: { x: 0, y: 0 } },
    });
    state = chainEditorReducer(state, {
      type: "GROUP_CREATED",
      payload: { clientGroupId: "g1", name: "그룹1", memberNodeIds: ["n1"] },
    });

    const next = chainEditorReducer(state, {
      type: "ELEMENTS_DELETED",
      payload: { nodeIds: ["n1"], edgeIds: [] },
    });
    expect(next.groups.g1).toEqual({ clientGroupId: "g1", name: "그룹1" });
    expect(next.nodes.n1).toBeUndefined();
  });
});
