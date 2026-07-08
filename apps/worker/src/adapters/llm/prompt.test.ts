import { describe, expect, it } from "vitest";
import { buildAliasMaps, buildAnalysisPrompt } from "./prompt";
import type { LlmAnalysisInput } from "./contract";

function baseInput(overrides: Partial<LlmAnalysisInput> = {}): LlmAnalysisInput {
  return {
    disclosure: {
      title: "단일판매·공급계약체결",
      disclosureDate: "2026-01-01",
      companyName: "A사",
      ticker: "000001",
      market: "KRX",
      url: "https://dart.fss.or.kr/x",
      contentExcerpt: "A사는 B사에 반도체 부품을 공급하기로 계약했다.",
    },
    chainContext: {
      chainName: "반도체 밸류체인",
      nodes: [
        { nodeId: "node-a-uuid", displayName: "A사", nodeKind: "listed_company" },
        { nodeId: "node-b-uuid", displayName: "B사", nodeKind: "listed_company" },
        { nodeId: "node-c-uuid", displayName: "C사", nodeKind: "free_subject" },
      ],
      edges: [{ sourceNodeId: "node-a-uuid", targetNodeId: "node-c-uuid", relationTypeName: "공급" }],
      activeRelationTypes: [
        { relationTypeId: "rel-supply-uuid", name: "공급", isDirected: true },
        { relationTypeId: "rel-compete-uuid", name: "경쟁", isDirected: false },
      ],
    },
    ...overrides,
  };
}

describe("buildAliasMaps", () => {
  it("assigns N1..Nn / R1..Rm aliases and round-trips through the reverse map", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);

    expect(aliasMaps.nodeAliasToId.size).toBe(3);
    expect(aliasMaps.relationAliasToId.size).toBe(2);
    expect([...aliasMaps.nodeAliasToId.keys()]).toEqual(["N1", "N2", "N3"]);
    expect([...aliasMaps.relationAliasToId.keys()]).toEqual(["R1", "R2"]);

    for (const [alias, nodeId] of aliasMaps.nodeAliasToId) {
      expect(aliasMaps.nodeIdToAlias.get(nodeId)).toBe(alias);
    }
    for (const [alias, relId] of aliasMaps.relationAliasToId) {
      expect(aliasMaps.relationIdToAlias.get(relId)).toBe(alias);
    }
  });
});

describe("buildAnalysisPrompt", () => {
  it("does not leak any node/relation-type UUIDs into the prompt text (R-12)", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const { system, user } = buildAnalysisPrompt(input, aliasMaps);

    const uuidPattern = /node-[abc]-uuid|rel-(supply|compete)-uuid/;
    expect(system).not.toMatch(uuidPattern);
    expect(user).not.toMatch(uuidPattern);
  });

  it("includes the content excerpt when present", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const { user } = buildAnalysisPrompt(input, aliasMaps);
    expect(user).toContain("A사는 B사에 반도체 부품을 공급하기로 계약했다.");
  });

  it("mentions that no document was retrieved when contentExcerpt is null", () => {
    const input = baseInput({
      disclosure: { ...baseInput().disclosure, contentExcerpt: null },
    });
    const aliasMaps = buildAliasMaps(input);
    const { user } = buildAnalysisPrompt(input, aliasMaps);
    expect(user).toMatch(/원문 미확보/);
  });

  it("includes node aliases, display names, and active relation type aliases in the user prompt", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const { user } = buildAnalysisPrompt(input, aliasMaps);
    expect(user).toContain("N1");
    expect(user).toContain("A사");
    expect(user).toContain("R1");
    expect(user).toContain("공급");
  });

  it("system prompt states the constraints (existing nodes only, no self-reference, relation type required)", () => {
    const input = baseInput();
    const aliasMaps = buildAliasMaps(input);
    const { system } = buildAnalysisPrompt(input, aliasMaps);
    expect(system).toMatch(/기존/);
    expect(system).toMatch(/자기 참조|자기참조/);
  });
});
