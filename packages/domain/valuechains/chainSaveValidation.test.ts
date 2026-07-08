import { describe, expect, it } from "vitest";
import { MAX_NODES_PER_CHAIN } from "../constants/limits";
import { validateChainStructure } from "./chainSaveValidation";
import type { SaveChainGroupPayload, SaveChainNodePayload } from "../types/chainSave";
import type { SaveEdgePayload } from "./edgeSaveValidation";

const listedNode = (overrides: Partial<SaveChainNodePayload> = {}): SaveChainNodePayload => ({
  clientNodeId: "n1",
  nodeKind: "listed_company",
  securityId: "s1",
  subjectName: null,
  subjectType: null,
  subjectMemo: null,
  groupClientId: null,
  positionX: 0,
  positionY: 0,
  ...overrides,
});

const freeNode = (overrides: Partial<SaveChainNodePayload> = {}): SaveChainNodePayload => ({
  clientNodeId: "n2",
  nodeKind: "free_subject",
  securityId: null,
  subjectName: "소비자",
  subjectType: "consumer",
  subjectMemo: null,
  groupClientId: null,
  positionX: 0,
  positionY: 0,
  ...overrides,
});

const noop = (): { groups: SaveChainGroupPayload[]; nodes: SaveChainNodePayload[]; edges: SaveEdgePayload[] } => ({
  groups: [],
  nodes: [],
  edges: [],
});

describe("validateChainStructure", () => {
  it("정상 페이로드(혼합 노드 2 + 그룹 1 + 엣지 1) → []", () => {
    const violations = validateChainStructure({
      groups: [{ clientGroupId: "g1", name: "소재" }],
      nodes: [listedNode({ groupClientId: "g1" }), freeNode()],
      edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt1" }],
    });
    expect(violations).toEqual([]);
  });

  it("노드 101개 → NODE_LIMIT_EXCEEDED / 정확히 100개 → 위반 없음(경계값)", () => {
    const at100 = Array.from({ length: MAX_NODES_PER_CHAIN }, (_, i) =>
      freeNode({ clientNodeId: `n${i}`, subjectName: `s${i}` }),
    );
    expect(validateChainStructure({ ...noop(), nodes: at100 })).toEqual([]);

    const at101 = [...at100, freeNode({ clientNodeId: "n-extra", subjectName: "extra" })];
    const violations = validateChainStructure({ ...noop(), nodes: at101 });
    expect(violations).toEqual([
      { reason: "NODE_LIMIT_EXCEEDED", targets: {} },
    ]);
  });

  it("listed_company + securityId=null → NODE_KIND_FIELD_MISMATCH(해당 clientNodeId 수집)", () => {
    const violations = validateChainStructure({ ...noop(), nodes: [listedNode({ securityId: null })] });
    expect(violations).toEqual([
      { reason: "NODE_KIND_FIELD_MISMATCH", targets: { clientNodeIds: ["n1"] } },
    ]);
  });

  it("listed_company + subjectName='x' → NODE_KIND_FIELD_MISMATCH", () => {
    const violations = validateChainStructure({ ...noop(), nodes: [listedNode({ subjectName: "x" })] });
    expect(violations[0]?.reason).toBe("NODE_KIND_FIELD_MISMATCH");
  });

  it("free_subject + subjectType=null → NODE_KIND_FIELD_MISMATCH", () => {
    const violations = validateChainStructure({ ...noop(), nodes: [freeNode({ subjectType: null })] });
    expect(violations[0]?.reason).toBe("NODE_KIND_FIELD_MISMATCH");
  });

  it("free_subject + subjectName='  ' → NODE_KIND_FIELD_MISMATCH", () => {
    const violations = validateChainStructure({ ...noop(), nodes: [freeNode({ subjectName: "   " })] });
    expect(violations[0]?.reason).toBe("NODE_KIND_FIELD_MISMATCH");
  });

  it("free_subject + securityId 설정 → NODE_KIND_FIELD_MISMATCH", () => {
    const violations = validateChainStructure({ ...noop(), nodes: [freeNode({ securityId: "s1" })] });
    expect(violations[0]?.reason).toBe("NODE_KIND_FIELD_MISMATCH");
  });

  it("동일 securityId 노드 3개 → DUPLICATE_SECURITY_NODE에 3개 clientNodeId 전부 수집", () => {
    const violations = validateChainStructure({
      ...noop(),
      nodes: [
        listedNode({ clientNodeId: "n1", securityId: "dup" }),
        listedNode({ clientNodeId: "n2", securityId: "dup" }),
        listedNode({ clientNodeId: "n3", securityId: "dup" }),
      ],
    });
    expect(violations).toEqual([
      { reason: "DUPLICATE_SECURITY_NODE", targets: { clientNodeIds: ["n1", "n2", "n3"] } },
    ]);
  });

  it("그룹 이름 공백 → GROUP_NAME_REQUIRED", () => {
    const violations = validateChainStructure({
      ...noop(),
      groups: [{ clientGroupId: "g1", name: "  " }],
    });
    expect(violations).toEqual([
      { reason: "GROUP_NAME_REQUIRED", targets: { clientGroupIds: ["g1"] } },
    ]);
  });

  it("미존재 groupClientId 참조 → GROUP_REF_INVALID", () => {
    const violations = validateChainStructure({
      ...noop(),
      nodes: [freeNode({ groupClientId: "missing" })],
    });
    expect(violations).toEqual([
      { reason: "GROUP_REF_INVALID", targets: { clientNodeIds: ["n2"] } },
    ]);
  });

  it("groupClientId=null 노드는 그룹 검증 통과(무소속 허용)", () => {
    const violations = validateChainStructure({ ...noop(), nodes: [freeNode({ groupClientId: null })] });
    expect(violations).toEqual([]);
  });

  it("clientNodeId 중복 2건 → DUPLICATE_CLIENT_ID", () => {
    const violations = validateChainStructure({
      ...noop(),
      nodes: [freeNode({ clientNodeId: "dup" }), freeNode({ clientNodeId: "dup", subjectName: "s2" })],
    });
    expect(violations).toEqual([
      { reason: "DUPLICATE_CLIENT_ID", targets: { clientNodeIds: ["dup"] } },
    ]);
  });

  it("복수 위반 혼재 시 전부 수집(순서 결정적)", () => {
    const violations = validateChainStructure({
      groups: [{ clientGroupId: "g1", name: "" }],
      nodes: [listedNode({ securityId: null })],
      edges: [],
    });
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.reason)).toEqual(["NODE_KIND_FIELD_MISMATCH", "GROUP_NAME_REQUIRED"]);
  });

  it("빈 groups/edges + 노드 1개 → 위반 없음(spec: 빈 배열 허용)", () => {
    const violations = validateChainStructure({ groups: [], nodes: [freeNode()], edges: [] });
    expect(violations).toEqual([]);
  });
});
