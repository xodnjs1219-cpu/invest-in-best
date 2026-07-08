import { describe, expect, it } from "vitest";
import { llmEnvelopeSchema, mapItemsToCandidates } from "./dto";
import { buildAliasMaps } from "./prompt";
import type { LlmAnalysisInput } from "./contract";

function baseInput(): LlmAnalysisInput {
  return {
    disclosure: {
      title: "제목",
      disclosureDate: "2026-01-01",
      companyName: "A사",
      ticker: "000001",
      market: "KRX",
      url: null,
      contentExcerpt: null,
    },
    chainContext: {
      chainName: "체인",
      nodes: [
        { nodeId: "node-a-uuid", displayName: "A사", nodeKind: "listed_company" },
        { nodeId: "node-b-uuid", displayName: "B사", nodeKind: "listed_company" },
      ],
      edges: [],
      activeRelationTypes: [{ relationTypeId: "rel-supply-uuid", name: "공급", isDirected: true }],
    },
  };
}

describe("llmEnvelopeSchema", () => {
  it("parses a valid envelope with a proposals array", () => {
    const result = llmEnvelopeSchema.safeParse({ proposals: [] });
    expect(result.success).toBe(true);
  });

  it("fails when 'proposals' key is missing", () => {
    const result = llmEnvelopeSchema.safeParse({ foo: "bar" });
    expect(result.success).toBe(false);
  });

  it("fails when 'proposals' is not an array", () => {
    const result = llmEnvelopeSchema.safeParse({ proposals: "not-an-array" });
    expect(result.success).toBe(false);
  });
});

describe("mapItemsToCandidates", () => {
  it("maps valid items to candidates with UUIDs resolved from aliases", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const items = [
      {
        proposalType: "relation_add",
        sourceNodeAlias: "N1",
        targetNodeAlias: "N2",
        relationTypeAlias: "R1",
        rationale: "공시에 따르면 공급 계약을 체결했다.",
      },
    ];

    const result = mapItemsToCandidates(items, aliasMaps);

    expect(result.candidates).toEqual([
      {
        proposalType: "relation_add",
        sourceNodeId: "node-a-uuid",
        targetNodeId: "node-b-uuid",
        relationTypeId: "rel-supply-uuid",
        rationale: "공시에 따르면 공급 계약을 체결했다.",
      },
    ]);
    expect(result.droppedItemCount).toBe(0);
  });

  it("returns an empty result for an empty items array (no relevant change)", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const result = mapItemsToCandidates([], aliasMaps);
    expect(result.candidates).toEqual([]);
    expect(result.droppedItemCount).toBe(0);
  });

  it("drops an item with an unknown node alias (E4 hallucination defense)", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const items = [
      {
        proposalType: "relation_add",
        sourceNodeAlias: "N99",
        targetNodeAlias: "N2",
        relationTypeAlias: "R1",
        rationale: "근거",
      },
    ];
    const result = mapItemsToCandidates(items, aliasMaps);
    expect(result.candidates).toEqual([]);
    expect(result.droppedItemCount).toBe(1);
  });

  it("drops an item missing relationTypeAlias (F-1 — relation type required for all proposal types)", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const items = [
      {
        proposalType: "relation_delete",
        sourceNodeAlias: "N1",
        targetNodeAlias: "N2",
        rationale: "근거",
      },
    ];
    const result = mapItemsToCandidates(items, aliasMaps);
    expect(result.candidates).toEqual([]);
    expect(result.droppedItemCount).toBe(1);
  });

  it("drops an item with an unknown relation type alias", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const items = [
      {
        proposalType: "relation_add",
        sourceNodeAlias: "N1",
        targetNodeAlias: "N2",
        relationTypeAlias: "R99",
        rationale: "근거",
      },
    ];
    const result = mapItemsToCandidates(items, aliasMaps);
    expect(result.droppedItemCount).toBe(1);
  });

  it("drops an item with an invalid proposalType enum value", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const items = [
      {
        proposalType: "relation_delete_all",
        sourceNodeAlias: "N1",
        targetNodeAlias: "N2",
        relationTypeAlias: "R1",
        rationale: "근거",
      },
    ];
    const result = mapItemsToCandidates(items, aliasMaps);
    expect(result.droppedItemCount).toBe(1);
  });

  it("drops an item with an empty rationale", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const items = [
      {
        proposalType: "relation_add",
        sourceNodeAlias: "N1",
        targetNodeAlias: "N2",
        relationTypeAlias: "R1",
        rationale: "",
      },
    ];
    const result = mapItemsToCandidates(items, aliasMaps);
    expect(result.droppedItemCount).toBe(1);
  });

  it("processes mixed valid/invalid items independently, counting drops without stopping", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const items = [
      {
        proposalType: "relation_add",
        sourceNodeAlias: "N1",
        targetNodeAlias: "N2",
        relationTypeAlias: "R1",
        rationale: "정상 항목 1",
      },
      { proposalType: "relation_add", sourceNodeAlias: "N99", targetNodeAlias: "N2", relationTypeAlias: "R1", rationale: "결측 별칭" },
      { proposalType: "relation_add", sourceNodeAlias: "N1", targetNodeAlias: "N2", rationale: "관계종류 결측" },
    ];
    const result = mapItemsToCandidates(items, aliasMaps);
    expect(result.candidates).toHaveLength(1);
    expect(result.droppedItemCount).toBe(2);
  });
});
