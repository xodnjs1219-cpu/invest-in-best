import { describe, expect, it } from "vitest";
import type { EditorEdge, EditorGroup, EditorNode, RelationType } from "../types/chainEditor";
import { MAX_NODES_PER_CHAIN } from "../constants/limits";
import {
  validateChainNameFormat,
  normalizeEdgePair,
  validateEdgeCandidate,
  validateListedNodeAdd,
  validateFreeSubjectAdd,
  validateGroupCreate,
  validateGroupRename,
} from "./editorValidation";

describe("validateChainNameFormat", () => {
  it("정상 이름 → null", () => {
    expect(validateChainNameFormat("반도체 밸류체인")).toBeNull();
  });

  it("앞뒤 공백 포함 이름(trim 후 비어있지 않음) → null", () => {
    expect(validateChainNameFormat("  이름  ")).toBeNull();
  });

  it("빈 문자열 → NAME_REQUIRED", () => {
    expect(validateChainNameFormat("")).toBe("NAME_REQUIRED");
  });

  it("공백만 → NAME_REQUIRED", () => {
    expect(validateChainNameFormat("   ")).toBe("NAME_REQUIRED");
  });

  it("탭/개행 등 화이트스페이스만 → NAME_REQUIRED", () => {
    expect(validateChainNameFormat("\t\n  \t")).toBe("NAME_REQUIRED");
  });
});

describe("normalizeEdgePair", () => {
  it("유향 관계: (B,A) → (B,A) 순서 유지", () => {
    expect(normalizeEdgePair("B", "A", true)).toEqual(["B", "A"]);
  });

  it("무향 관계: (B,A) → (A,B) 사전순 정렬", () => {
    expect(normalizeEdgePair("B", "A", false)).toEqual(["A", "B"]);
  });

  it("무향 관계: 이미 정렬된 (A,B) → (A,B) 그대로", () => {
    expect(normalizeEdgePair("A", "B", false)).toEqual(["A", "B"]);
  });
});

describe("validateEdgeCandidate", () => {
  const nodeA: EditorNode = {
    clientNodeId: "A",
    groupClientId: null,
    position: { x: 0, y: 0 },
    nodeKind: "free_subject",
    subjectType: "consumer",
    subjectName: "소비자",
    subjectMemo: null,
  };
  const nodeB: EditorNode = {
    clientNodeId: "B",
    groupClientId: null,
    position: { x: 0, y: 0 },
    nodeKind: "free_subject",
    subjectType: "consumer",
    subjectName: "소비자B",
    subjectMemo: null,
  };

  const supplyType: RelationType = { id: "rt-supply", name: "공급", isDirected: true, isActive: true };
  const competeType: RelationType = { id: "rt-compete", name: "경쟁", isDirected: false, isActive: true };
  const inactiveType: RelationType = { id: "rt-inactive", name: "구관계", isDirected: true, isActive: false };

  const relationTypeById = new Map<string, RelationType>([
    [supplyType.id, supplyType],
    [competeType.id, competeType],
    [inactiveType.id, inactiveType],
  ]);

  function makeState(nodes: EditorNode[], edges: EditorEdge[]) {
    return {
      nodes: Object.fromEntries(nodes.map((n) => [n.clientNodeId, n])),
      edges: Object.fromEntries(edges.map((e) => [e.clientEdgeId, e])),
    };
  }

  it("source/target 노드가 state.nodes에 없으면 NODE_NOT_FOUND", () => {
    const state = makeState([nodeA], []);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "A", targetClientNodeId: "X", relationTypeId: supplyType.id },
      relationTypeById,
    );
    expect(result).toBe("NODE_NOT_FOUND");
  });

  it("자기 참조(source===target) → SELF_REFERENCE", () => {
    const state = makeState([nodeA, nodeB], []);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "A", targetClientNodeId: "A", relationTypeId: supplyType.id },
      relationTypeById,
    );
    expect(result).toBe("SELF_REFERENCE");
  });

  it("비활성 관계 종류 선택 → RELATION_TYPE_INACTIVE", () => {
    const state = makeState([nodeA, nodeB], []);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "A", targetClientNodeId: "B", relationTypeId: inactiveType.id },
      relationTypeById,
    );
    expect(result).toBe("RELATION_TYPE_INACTIVE");
  });

  it("존재하지 않는 관계 종류 ID → RELATION_TYPE_INACTIVE", () => {
    const state = makeState([nodeA, nodeB], []);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "A", targetClientNodeId: "B", relationTypeId: "missing" },
      relationTypeById,
    );
    expect(result).toBe("RELATION_TYPE_INACTIVE");
  });

  it("유향: (A,B,공급) 존재 + (A,B,공급) 후보 → DUPLICATE_RELATION", () => {
    const existing: EditorEdge = {
      clientEdgeId: "e1",
      sourceClientNodeId: "A",
      targetClientNodeId: "B",
      relationTypeId: supplyType.id,
    };
    const state = makeState([nodeA, nodeB], [existing]);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "A", targetClientNodeId: "B", relationTypeId: supplyType.id },
      relationTypeById,
    );
    expect(result).toBe("DUPLICATE_RELATION");
  });

  it("유향: (A,B,공급) 존재 + (B,A,공급) 후보 → null(역방향은 별개 쌍)", () => {
    const existing: EditorEdge = {
      clientEdgeId: "e1",
      sourceClientNodeId: "A",
      targetClientNodeId: "B",
      relationTypeId: supplyType.id,
    };
    const state = makeState([nodeA, nodeB], [existing]);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "B", targetClientNodeId: "A", relationTypeId: supplyType.id },
      relationTypeById,
    );
    expect(result).toBeNull();
  });

  it("무향: (A,B,경쟁) 존재 + (B,A,경쟁) 후보 → DUPLICATE_RELATION", () => {
    const existing: EditorEdge = {
      clientEdgeId: "e1",
      sourceClientNodeId: "A",
      targetClientNodeId: "B",
      relationTypeId: competeType.id,
    };
    const state = makeState([nodeA, nodeB], [existing]);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "B", targetClientNodeId: "A", relationTypeId: competeType.id },
      relationTypeById,
    );
    expect(result).toBe("DUPLICATE_RELATION");
  });

  it("(A,B,공급) 존재 + (A,B,지분투자류=경쟁) 다른 종류 후보 → null(병존 허용)", () => {
    const existing: EditorEdge = {
      clientEdgeId: "e1",
      sourceClientNodeId: "A",
      targetClientNodeId: "B",
      relationTypeId: supplyType.id,
    };
    const state = makeState([nodeA, nodeB], [existing]);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "A", targetClientNodeId: "B", relationTypeId: competeType.id },
      relationTypeById,
    );
    expect(result).toBeNull();
  });

  it("excludeEdgeId: 자기 자신을 제외하고 재검증하면 충돌 없음", () => {
    const existing: EditorEdge = {
      clientEdgeId: "e1",
      sourceClientNodeId: "A",
      targetClientNodeId: "B",
      relationTypeId: supplyType.id,
    };
    const state = makeState([nodeA, nodeB], [existing]);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "A", targetClientNodeId: "B", relationTypeId: supplyType.id },
      relationTypeById,
      { excludeEdgeId: "e1" },
    );
    expect(result).toBeNull();
  });

  it("검증 통과(신규 쌍 + 활성 종류) → null", () => {
    const state = makeState([nodeA, nodeB], []);
    const result = validateEdgeCandidate(
      state,
      { sourceClientNodeId: "A", targetClientNodeId: "B", relationTypeId: supplyType.id },
      relationTypeById,
    );
    expect(result).toBeNull();
  });
});

describe("validateListedNodeAdd", () => {
  function makeNodesState(nodes: EditorNode[]) {
    return { nodes: Object.fromEntries(nodes.map((n) => [n.clientNodeId, n])) };
  }

  it("노드 0개 + 임의 securityId → null(정상 추가 허용)", () => {
    const state = makeNodesState([]);
    expect(validateListedNodeAdd(state, "s1")).toBeNull();
  });

  it(`노드 ${MAX_NODES_PER_CHAIN - 1}개 → null, ${MAX_NODES_PER_CHAIN}개 → NODE_LIMIT_REACHED(경계값)`, () => {
    const belowLimit = Array.from({ length: MAX_NODES_PER_CHAIN - 1 }, (_, i) => ({
      clientNodeId: `n${i}`,
      groupClientId: null,
      position: { x: 0, y: 0 },
      nodeKind: "free_subject" as const,
      subjectType: "other" as const,
      subjectName: `s${i}`,
      subjectMemo: null,
    }));
    expect(validateListedNodeAdd(makeNodesState(belowLimit), "new-security")).toBeNull();

    const atLimit = [
      ...belowLimit,
      {
        clientNodeId: "n-last",
        groupClientId: null,
        position: { x: 0, y: 0 },
        nodeKind: "free_subject" as const,
        subjectType: "other" as const,
        subjectName: "last",
        subjectMemo: null,
      },
    ];
    expect(validateListedNodeAdd(makeNodesState(atLimit), "new-security")).toBe("NODE_LIMIT_REACHED");
  });

  it("동일 securityId의 listed_company 노드 존재 → DUPLICATE_SECURITY", () => {
    const existing: EditorNode = {
      clientNodeId: "n1",
      groupClientId: null,
      position: { x: 0, y: 0 },
      nodeKind: "listed_company",
      security: { securityId: "s1", ticker: "005930", name: "삼성전자", market: "KRX" },
    };
    const state = makeNodesState([existing]);
    expect(validateListedNodeAdd(state, "s1")).toBe("DUPLICATE_SECURITY");
  });

  it("free_subject 노드만 존재 + 신규 종목 → null(자유 주체는 중복 판정 무관)", () => {
    const freeSubject: EditorNode = {
      clientNodeId: "n1",
      groupClientId: null,
      position: { x: 0, y: 0 },
      nodeKind: "free_subject",
      subjectType: "consumer",
      subjectName: "소비자",
      subjectMemo: null,
    };
    const state = makeNodesState([freeSubject]);
    expect(validateListedNodeAdd(state, "s1")).toBeNull();
  });
});

describe("validateFreeSubjectAdd", () => {
  function makeNodesState(nodes: EditorNode[]) {
    return { nodes: Object.fromEntries(nodes.map((n) => [n.clientNodeId, n])) };
  }

  it("정상 입력(유형+이름) → null", () => {
    const state = makeNodesState([]);
    expect(validateFreeSubjectAdd(state, { subjectType: "consumer", subjectName: "일반 소비자" })).toBeNull();
  });

  it("subjectType=null → SUBJECT_FIELD_REQUIRED", () => {
    const state = makeNodesState([]);
    expect(validateFreeSubjectAdd(state, { subjectType: null, subjectName: "이름" })).toBe(
      "SUBJECT_FIELD_REQUIRED",
    );
  });

  it("subjectName 공백만 → SUBJECT_FIELD_REQUIRED", () => {
    const state = makeNodesState([]);
    expect(validateFreeSubjectAdd(state, { subjectType: "consumer", subjectName: "   " })).toBe(
      "SUBJECT_FIELD_REQUIRED",
    );
  });

  it(`노드 ${MAX_NODES_PER_CHAIN}개 상태 → NODE_LIMIT_REACHED`, () => {
    const atLimit = Array.from({ length: MAX_NODES_PER_CHAIN }, (_, i) => ({
      clientNodeId: `n${i}`,
      groupClientId: null,
      position: { x: 0, y: 0 },
      nodeKind: "free_subject" as const,
      subjectType: "other" as const,
      subjectName: `s${i}`,
      subjectMemo: null,
    }));
    const state = makeNodesState(atLimit);
    expect(validateFreeSubjectAdd(state, { subjectType: "consumer", subjectName: "새 주체" })).toBe(
      "NODE_LIMIT_REACHED",
    );
  });

  it("동일 이름·유형 중복 → 차단하지 않음(BR-2는 종목 노드 전용)", () => {
    const existing: EditorNode = {
      clientNodeId: "n1",
      groupClientId: null,
      position: { x: 0, y: 0 },
      nodeKind: "free_subject",
      subjectType: "consumer",
      subjectName: "일반 소비자",
      subjectMemo: null,
    };
    const state = makeNodesState([existing]);
    expect(validateFreeSubjectAdd(state, { subjectType: "consumer", subjectName: "일반 소비자" })).toBeNull();
  });
});

// ============================================================================
// UC-017: 그룹 편집 검증
// ============================================================================

describe("validateGroupCreate", () => {
  it("이름 유효 + 멤버 1개 이상 → null", () => {
    expect(validateGroupCreate({ name: "소재", memberNodeIds: ["n1"] })).toBeNull();
  });

  it("이름 빈 문자열 → NAME_REQUIRED", () => {
    expect(validateGroupCreate({ name: "", memberNodeIds: ["n1"] })).toBe("NAME_REQUIRED");
  });

  it("이름 공백만 → NAME_REQUIRED", () => {
    expect(validateGroupCreate({ name: "   ", memberNodeIds: ["n1"] })).toBe("NAME_REQUIRED");
  });

  it("선택 노드 0개 → NO_NODES_SELECTED", () => {
    expect(validateGroupCreate({ name: "소재", memberNodeIds: [] })).toBe("NO_NODES_SELECTED");
  });

  it("이름 공백 + 선택 0개 동시 위반 → NAME_REQUIRED(판정 순서 결정성)", () => {
    expect(validateGroupCreate({ name: "", memberNodeIds: [] })).toBe("NAME_REQUIRED");
  });

  it("기존 그룹과 동일한 이름으로 생성 → null(중복 허용 — E3)", () => {
    expect(validateGroupCreate({ name: "소재", memberNodeIds: ["n1"] })).toBeNull();
  });
});

describe("validateGroupRename", () => {
  function makeGroupsState(groups: EditorGroup[]) {
    return { groups: Object.fromEntries(groups.map((g) => [g.clientGroupId, g])) };
  }

  it("미존재 그룹 → GROUP_NOT_FOUND", () => {
    const state = makeGroupsState([]);
    expect(validateGroupRename(state, "g1", "새 이름")).toBe("GROUP_NOT_FOUND");
  });

  it("존재 + 공백 이름 → NAME_REQUIRED", () => {
    const state = makeGroupsState([{ clientGroupId: "g1", name: "소재" }]);
    expect(validateGroupRename(state, "g1", "   ")).toBe("NAME_REQUIRED");
  });

  it("존재 + 유효 이름 → null", () => {
    const state = makeGroupsState([{ clientGroupId: "g1", name: "소재" }]);
    expect(validateGroupRename(state, "g1", "새 이름")).toBeNull();
  });
});
