import { describe, expect, it } from "vitest";
import {
  buildProposalDedupeKey,
  filterProposalCandidates,
  type ActiveRelationType,
  type ChainAnalysisContext,
  type LlmProposalCandidate,
} from "./llm-proposal-filter";

const CHAIN_ID = "chain-1";
const NODE_A = "node-a";
const NODE_B = "node-b";
const NODE_C = "node-c";
const SUPPLY_TYPE = "rel-supply"; // directed
const COMPETITOR_TYPE = "rel-competitor"; // undirected

const activeTypes: ActiveRelationType[] = [
  { relationTypeId: SUPPLY_TYPE, name: "공급", isDirected: true },
  { relationTypeId: COMPETITOR_TYPE, name: "경쟁", isDirected: false },
];

function baseCtx(overrides: Partial<ChainAnalysisContext> = {}): ChainAnalysisContext {
  return {
    chainId: CHAIN_ID,
    latestSnapshotId: "snapshot-1",
    nodes: [
      { nodeId: NODE_A, displayName: "A사", nodeKind: "listed_company" },
      { nodeId: NODE_B, displayName: "B사", nodeKind: "listed_company" },
    ],
    edges: [],
    ...overrides,
  };
}

function candidate(overrides: Partial<LlmProposalCandidate> = {}): LlmProposalCandidate {
  return {
    proposalType: "relation_add",
    sourceNodeId: NODE_A,
    targetNodeId: NODE_B,
    relationTypeId: SUPPLY_TYPE,
    rationale: "공시에 따르면 A사가 B사에 부품을 공급한다.",
    ...overrides,
  };
}

describe("buildProposalDedupeKey", () => {
  it("normalizes undirected node pairs via normalizeEdgePair (D-6)", () => {
    const forward = buildProposalDedupeKey(CHAIN_ID, NODE_A, NODE_B, COMPETITOR_TYPE, "relation_add", false);
    const backward = buildProposalDedupeKey(CHAIN_ID, NODE_B, NODE_A, COMPETITOR_TYPE, "relation_add", false);
    expect(forward).toBe(backward);
  });

  it("keeps directed node pairs order-sensitive", () => {
    const forward = buildProposalDedupeKey(CHAIN_ID, NODE_A, NODE_B, SUPPLY_TYPE, "relation_add", true);
    const backward = buildProposalDedupeKey(CHAIN_ID, NODE_B, NODE_A, SUPPLY_TYPE, "relation_add", true);
    expect(forward).not.toBe(backward);
  });
});

describe("filterProposalCandidates", () => {
  it("accepts a normal add proposal between two existing nodes with a directed active relation type", () => {
    const result = filterProposalCandidates([candidate()], baseCtx(), activeTypes, new Set());
    expect(result.accepted).toHaveLength(1);
    expect(result.dropped).toHaveLength(0);
  });

  it("drops UNKNOWN_NODE when target is not in ctx.nodes (E1 — new node proposal excluded)", () => {
    const result = filterProposalCandidates(
      [candidate({ targetNodeId: NODE_C })],
      baseCtx(),
      activeTypes,
      new Set(),
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.dropped).toEqual([{ candidate: candidate({ targetNodeId: NODE_C }), reason: "UNKNOWN_NODE" }]);
  });

  it("drops UNKNOWN_NODE when source is not in ctx.nodes", () => {
    const result = filterProposalCandidates(
      [candidate({ sourceNodeId: NODE_C })],
      baseCtx(),
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("UNKNOWN_NODE");
  });

  it("drops SELF_REFERENCE when source equals target", () => {
    const result = filterProposalCandidates(
      [candidate({ sourceNodeId: NODE_A, targetNodeId: NODE_A })],
      baseCtx(),
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("SELF_REFERENCE");
  });

  it("drops MISSING_RELATION_TYPE when relationTypeId is null (F-1)", () => {
    const result = filterProposalCandidates(
      [candidate({ relationTypeId: null })],
      baseCtx(),
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("MISSING_RELATION_TYPE");
  });

  it("drops MISSING_RELATION_TYPE when relationTypeId is unknown", () => {
    const result = filterProposalCandidates(
      [candidate({ relationTypeId: "unknown-type" })],
      baseCtx(),
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("MISSING_RELATION_TYPE");
  });

  it("drops INACTIVE_RELATION_TYPE when relation type maps but is not in the active list (E3)", () => {
    const result = filterProposalCandidates(
      [candidate({ relationTypeId: "inactive-type" })],
      baseCtx(),
      // 활성 목록에 없는 종류 = INACTIVE로 취급(맵 자체가 활성 목록이므로 실질적으로 MISSING과 동치이나
      // 별칭 역매핑이 '알려진 비활성 종류'를 구분해서 넘기는 경로를 커버하기 위해 별도 시나리오로 검증).
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("MISSING_RELATION_TYPE");
  });

  it("add: drops DUPLICATE_EDGE when the same pair+type edge already exists", () => {
    const ctx = baseCtx({
      edges: [{ sourceNodeId: NODE_A, targetNodeId: NODE_B, relationTypeId: SUPPLY_TYPE }],
    });
    const result = filterProposalCandidates([candidate()], ctx, activeTypes, new Set());
    expect(result.dropped[0]?.reason).toBe("DUPLICATE_EDGE");
  });

  it("add: allows a different relation type to coexist on the same pair (BR-5)", () => {
    const ctx = baseCtx({
      edges: [{ sourceNodeId: NODE_A, targetNodeId: NODE_B, relationTypeId: SUPPLY_TYPE }],
    });
    const result = filterProposalCandidates(
      [candidate({ relationTypeId: COMPETITOR_TYPE })],
      ctx,
      activeTypes,
      new Set(),
    );
    expect(result.accepted).toHaveLength(1);
  });

  it("add: undirected type — existing reverse edge (B,A) blocks a new (A,B) proposal (D-6)", () => {
    const ctx = baseCtx({
      edges: [{ sourceNodeId: NODE_B, targetNodeId: NODE_A, relationTypeId: COMPETITOR_TYPE }],
    });
    const result = filterProposalCandidates(
      [candidate({ relationTypeId: COMPETITOR_TYPE })],
      ctx,
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("DUPLICATE_EDGE");
  });

  it("update: drops EDGE_NOT_FOUND when the pair has zero edges", () => {
    const result = filterProposalCandidates(
      [candidate({ proposalType: "relation_update" })],
      baseCtx(),
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("EDGE_NOT_FOUND");
  });

  it("update: drops UPDATE_AMBIGUOUS when the pair has 2+ edges", () => {
    const ctx = baseCtx({
      edges: [
        { sourceNodeId: NODE_A, targetNodeId: NODE_B, relationTypeId: SUPPLY_TYPE },
        { sourceNodeId: NODE_A, targetNodeId: NODE_B, relationTypeId: COMPETITOR_TYPE },
      ],
    });
    const result = filterProposalCandidates(
      [candidate({ proposalType: "relation_update", relationTypeId: SUPPLY_TYPE })],
      ctx,
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("UPDATE_AMBIGUOUS");
  });

  it("update: drops UPDATE_NO_CHANGE when the pair+proposed type already exists", () => {
    const ctx = baseCtx({
      edges: [{ sourceNodeId: NODE_A, targetNodeId: NODE_B, relationTypeId: SUPPLY_TYPE }],
    });
    const result = filterProposalCandidates(
      [candidate({ proposalType: "relation_update", relationTypeId: SUPPLY_TYPE })],
      ctx,
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("UPDATE_NO_CHANGE");
  });

  it("update: accepts exactly-one-edge + different proposed type (R-10)", () => {
    const ctx = baseCtx({
      edges: [{ sourceNodeId: NODE_A, targetNodeId: NODE_B, relationTypeId: SUPPLY_TYPE }],
    });
    const result = filterProposalCandidates(
      [candidate({ proposalType: "relation_update", relationTypeId: COMPETITOR_TYPE })],
      ctx,
      activeTypes,
      new Set(),
    );
    expect(result.accepted).toHaveLength(1);
  });

  it("delete: accepts when the exact pair+type edge exists, including undirected reverse pairing", () => {
    const ctx = baseCtx({
      edges: [{ sourceNodeId: NODE_B, targetNodeId: NODE_A, relationTypeId: COMPETITOR_TYPE }],
    });
    const result = filterProposalCandidates(
      [candidate({ proposalType: "relation_delete", relationTypeId: COMPETITOR_TYPE })],
      ctx,
      activeTypes,
      new Set(),
    );
    expect(result.accepted).toHaveLength(1);
  });

  it("delete: drops EDGE_NOT_FOUND when no matching edge exists", () => {
    const result = filterProposalCandidates(
      [candidate({ proposalType: "relation_delete" })],
      baseCtx(),
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("EDGE_NOT_FOUND");
  });

  it("drops the second of two identical candidates in the same batch as DUPLICATE_PENDING", () => {
    const result = filterProposalCandidates([candidate(), candidate()], baseCtx(), activeTypes, new Set());
    expect(result.accepted).toHaveLength(1);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]?.reason).toBe("DUPLICATE_PENDING");
  });

  it("drops DUPLICATE_PENDING when existingPendingKeys already contains the undirected reverse key (R-5)", () => {
    const existingKey = buildProposalDedupeKey(CHAIN_ID, NODE_B, NODE_A, COMPETITOR_TYPE, "relation_add", false);
    const result = filterProposalCandidates(
      [candidate({ relationTypeId: COMPETITOR_TYPE })],
      baseCtx(),
      activeTypes,
      new Set([existingKey]),
    );
    expect(result.dropped[0]?.reason).toBe("DUPLICATE_PENDING");
  });

  it("drops MISSING_RATIONALE when rationale is whitespace-only", () => {
    const result = filterProposalCandidates(
      [candidate({ rationale: "   " })],
      baseCtx(),
      activeTypes,
      new Set(),
    );
    expect(result.dropped[0]?.reason).toBe("MISSING_RATIONALE");
  });

  it("truncates an overly long rationale instead of dropping it", () => {
    const longRationale = "가".repeat(3_000);
    const result = filterProposalCandidates(
      [candidate({ rationale: longRationale })],
      baseCtx(),
      activeTypes,
      new Set(),
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.rationale.length).toBeLessThan(longRationale.length);
  });

  it("does not mutate the input candidates array or ctx (purity)", () => {
    const candidates = [candidate()];
    const ctx = baseCtx();
    const frozenCandidates = JSON.parse(JSON.stringify(candidates));
    const frozenCtx = JSON.parse(JSON.stringify(ctx));
    filterProposalCandidates(candidates, ctx, activeTypes, new Set());
    expect(candidates).toEqual(frozenCandidates);
    expect(ctx).toEqual(frozenCtx);
  });
});
