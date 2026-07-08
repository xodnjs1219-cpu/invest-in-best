import { describe, expect, it } from "vitest";
import {
  isEdgePreexisting,
  validateEdgesPayload,
  type NodeIdentity,
  type PreviousEdgeIdentity,
} from "./edgeSaveValidation";

const SECURITY_A: NodeIdentity = { kind: "listed_company", securityId: "sec-a" };
const SECURITY_B: NodeIdentity = { kind: "listed_company", securityId: "sec-b" };
const SUBJECT_A: NodeIdentity = { kind: "free_subject", subjectName: "소비자", subjectType: "consumer" };
const SUBJECT_A_DIFF_TYPE: NodeIdentity = { kind: "free_subject", subjectName: "소비자", subjectType: "government" };

describe("isEdgePreexisting", () => {
  it("유향: 직전 (A,B,종류) + 후보 (A,B,종류) → true", () => {
    const previous: PreviousEdgeIdentity[] = [
      { relationTypeId: "rt1", source: SECURITY_A, target: SECURITY_B },
    ];
    const result = isEdgePreexisting(
      { source: SECURITY_A, target: SECURITY_B, relationTypeId: "rt1" },
      previous,
      true,
    );
    expect(result).toBe(true);
  });

  it("무향: 직전 (A,B) + 후보 (B,A) → true(정규화 대조)", () => {
    const previous: PreviousEdgeIdentity[] = [
      { relationTypeId: "rt1", source: SECURITY_A, target: SECURITY_B },
    ];
    const result = isEdgePreexisting(
      { source: SECURITY_B, target: SECURITY_A, relationTypeId: "rt1" },
      previous,
      false,
    );
    expect(result).toBe(true);
  });

  it("유향: 직전 (A,B) + 후보 (B,A) → false(별개 쌍)", () => {
    const previous: PreviousEdgeIdentity[] = [
      { relationTypeId: "rt1", source: SECURITY_A, target: SECURITY_B },
    ];
    const result = isEdgePreexisting(
      { source: SECURITY_B, target: SECURITY_A, relationTypeId: "rt1" },
      previous,
      true,
    );
    expect(result).toBe(false);
  });

  it("자유 주체: 이름+유형 동일 → true", () => {
    const previous: PreviousEdgeIdentity[] = [
      { relationTypeId: "rt1", source: SUBJECT_A, target: SECURITY_B },
    ];
    const result = isEdgePreexisting(
      { source: SUBJECT_A, target: SECURITY_B, relationTypeId: "rt1" },
      previous,
      true,
    );
    expect(result).toBe(true);
  });

  it("자유 주체: 이름 동일·유형 상이 → false(D-7)", () => {
    const previous: PreviousEdgeIdentity[] = [
      { relationTypeId: "rt1", source: SUBJECT_A, target: SECURITY_B },
    ];
    const result = isEdgePreexisting(
      { source: SUBJECT_A_DIFF_TYPE, target: SECURITY_B, relationTypeId: "rt1" },
      previous,
      true,
    );
    expect(result).toBe(false);
  });

  it("직전 목록에 없음 → false", () => {
    const result = isEdgePreexisting(
      { source: SECURITY_A, target: SECURITY_B, relationTypeId: "rt1" },
      [],
      true,
    );
    expect(result).toBe(false);
  });
});

describe("validateEdgesPayload", () => {
  const nodes = [
    { clientNodeId: "n1", identity: SECURITY_A },
    { clientNodeId: "n2", identity: SECURITY_B },
  ];
  const relationTypes = new Map([
    ["rt-active", { isDirected: true, isActive: true }],
    ["rt-inactive", { isDirected: true, isActive: false }],
    ["rt-compete", { isDirected: false, isActive: true }],
  ]);

  it("자기 참조 엣지 → EDGE_SELF_REFERENCE + clientEdgeId 포함", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n1", relationTypeId: "rt-active" }],
      relationTypes,
      previousEdges: null,
      enforceActiveForNewEdges: false,
    });
    expect(violations).toEqual([
      {
        reason: "EDGE_SELF_REFERENCE",
        edge: { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n1", relationTypeId: "rt-active" },
      },
    ]);
  });

  it("미존재 clientNodeId 참조 → EDGE_NODE_REF_INVALID", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "missing", relationTypeId: "rt-active" }],
      relationTypes,
      previousEdges: null,
      enforceActiveForNewEdges: false,
    });
    expect(violations).toEqual([
      expect.objectContaining({ reason: "EDGE_NODE_REF_INVALID" }),
    ]);
  });

  it("미존재 relationTypeId → RELATION_TYPE_NOT_FOUND", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "missing-rt" }],
      relationTypes,
      previousEdges: null,
      enforceActiveForNewEdges: false,
    });
    expect(violations).toEqual([
      expect.objectContaining({ reason: "RELATION_TYPE_NOT_FOUND" }),
    ]);
  });

  it("유향 동일 (A,B,종류) 2건 → EDGE_DUPLICATE_RELATION", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [
        { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt-active" },
        { clientEdgeId: "e2", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt-active" },
      ],
      relationTypes,
      previousEdges: null,
      enforceActiveForNewEdges: false,
    });
    expect(violations.some((v) => v.reason === "EDGE_DUPLICATE_RELATION")).toBe(true);
  });

  it("유향 (A,B)+(B,A) 동일 종류 → 위반 없음(별개 쌍)", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [
        { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt-active" },
        { clientEdgeId: "e2", sourceClientNodeId: "n2", targetClientNodeId: "n1", relationTypeId: "rt-active" },
      ],
      relationTypes,
      previousEdges: null,
      enforceActiveForNewEdges: false,
    });
    expect(violations).toEqual([]);
  });

  it("무향 (A,B)+(B,A) 동일 종류 → EDGE_DUPLICATE_RELATION(D-6)", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [
        { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt-compete" },
        { clientEdgeId: "e2", sourceClientNodeId: "n2", targetClientNodeId: "n1", relationTypeId: "rt-compete" },
      ],
      relationTypes,
      previousEdges: null,
      enforceActiveForNewEdges: false,
    });
    expect(violations.some((v) => v.reason === "EDGE_DUPLICATE_RELATION")).toBe(true);
  });

  it("enforceActiveForNewEdges=false + 비활성 종류 → 위반 없음(사용자 체인, UC-018 BR-8)", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt-inactive" }],
      relationTypes,
      previousEdges: null,
      enforceActiveForNewEdges: false,
    });
    expect(violations).toEqual([]);
  });

  it("enforceActiveForNewEdges=true + 비활성 + 직전에 동일 엣지 존재 → 위반 없음(BR-4 기존 유지)", () => {
    const previousEdges: PreviousEdgeIdentity[] = [
      { relationTypeId: "rt-inactive", source: SECURITY_A, target: SECURITY_B },
    ];
    const violations = validateEdgesPayload({
      nodes,
      edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt-inactive" }],
      relationTypes,
      previousEdges,
      enforceActiveForNewEdges: true,
    });
    expect(violations).toEqual([]);
  });

  it("enforceActiveForNewEdges=true + 비활성 + 직전에 없음 → RELATION_TYPE_INACTIVE_FOR_NEW_EDGE", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt-inactive" }],
      relationTypes,
      previousEdges: [],
      enforceActiveForNewEdges: true,
    });
    expect(violations).toEqual([
      expect.objectContaining({ reason: "RELATION_TYPE_INACTIVE_FOR_NEW_EDGE" }),
    ]);
  });

  it("previousEdges=null(신규 저장) + 비활성 + enforce=true → RELATION_TYPE_INACTIVE_FOR_NEW_EDGE", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "rt-inactive" }],
      relationTypes,
      previousEdges: null,
      enforceActiveForNewEdges: true,
    });
    expect(violations).toEqual([
      expect.objectContaining({ reason: "RELATION_TYPE_INACTIVE_FOR_NEW_EDGE" }),
    ]);
  });

  it("복수 위반 혼재 시 전부 수집", () => {
    const violations = validateEdgesPayload({
      nodes,
      edges: [
        { clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n1", relationTypeId: "rt-active" },
        { clientEdgeId: "e2", sourceClientNodeId: "n1", targetClientNodeId: "missing", relationTypeId: "rt-active" },
      ],
      relationTypes,
      previousEdges: null,
      enforceActiveForNewEdges: false,
    });
    expect(violations).toHaveLength(2);
  });
});
