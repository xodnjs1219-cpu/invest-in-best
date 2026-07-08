import { describe, expect, it, vi } from "vitest";
import { createLlmClient } from "./client";
import { createRateLimiter } from "../../runtime/rate-limiter";
import { LlmConfigError, LlmRequestError, type LlmAnalysisInput } from "./contract";
import type { WorkerConfig } from "../../runtime/config";

const baseConfig: WorkerConfig = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role-key",
  tossClientId: "client-id",
  tossClientSecret: "client-secret",
  opendartApiKey: "a".repeat(40),
  secEdgarUserAgent: "InvestInBest admin@example.com",
  workerTmpDir: undefined,
  anthropicApiKey: "sk-ant-test-key",
  openaiApiKey: undefined,
};

function makeClock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    clock: {
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        now += ms;
      },
    },
    sleeps,
  };
}

function makeRateLimiter(clock: ReturnType<typeof makeClock>["clock"]) {
  return createRateLimiter({ groups: { LLM: { tps: 1 } }, clock });
}

function baseInput(): LlmAnalysisInput {
  return {
    disclosure: {
      title: "단일판매·공급계약체결",
      disclosureDate: "2026-01-01",
      companyName: "A사",
      ticker: "000001",
      market: "KRX",
      url: "https://dart.fss.or.kr/x",
      contentExcerpt: "A사가 B사에 공급 계약을 체결했다.",
    },
    chainContext: {
      chainName: "반도체 밸류체인",
      nodes: [
        { nodeId: "node-a-uuid", displayName: "A사", nodeKind: "listed_company" },
        { nodeId: "node-b-uuid", displayName: "B사", nodeKind: "listed_company" },
      ],
      edges: [],
      activeRelationTypes: [{ relationTypeId: "rel-supply-uuid", name: "공급", isDirected: true }],
    },
  };
}

function toolUseResponse(proposals: unknown[]) {
  return {
    content: [
      {
        type: "tool_use",
        id: "toolu_1",
        name: "propose_relation_changes",
        input: { proposals },
      },
    ],
  };
}

describe("createLlmClient (UC-030 M6 — Anthropic adapter)", () => {
  it("throws LlmConfigError when the API key is missing (E14)", () => {
    const { clock } = makeClock();
    const config: WorkerConfig = { ...baseConfig, anthropicApiKey: undefined };
    expect(() => createLlmClient({ config, rateLimiter: makeRateLimiter(clock) })).toThrow(LlmConfigError);
  });

  it("returns alias-resolved candidates and droppedItemCount on a valid structured response", async () => {
    const { clock } = makeClock();
    const create = vi.fn().mockResolvedValue(
      toolUseResponse([
        {
          proposalType: "relation_add",
          sourceNodeAlias: "N1",
          targetNodeAlias: "N2",
          relationTypeAlias: "R1",
          rationale: "공시에 따르면 공급 계약을 체결했다.",
        },
      ]),
    );
    const client = createLlmClient({
      config: baseConfig,
      rateLimiter: makeRateLimiter(clock),
      clock,
      anthropicClient: { messages: { create } } as never,
    });

    const outcome = await client.analyzeDisclosure(baseInput());
    expect(outcome.proposals).toEqual([
      {
        proposalType: "relation_add",
        sourceNodeId: "node-a-uuid",
        targetNodeId: "node-b-uuid",
        relationTypeId: "rel-supply-uuid",
        rationale: "공시에 따르면 공급 계약을 체결했다.",
      },
    ]);
    expect(outcome.droppedItemCount).toBe(0);
  });

  it("calls rateLimiter.acquire('LLM') before invoking the SDK", async () => {
    const { clock } = makeClock();
    const rateLimiter = makeRateLimiter(clock);
    const acquireSpy = vi.spyOn(rateLimiter, "acquire");
    const create = vi.fn().mockResolvedValue(toolUseResponse([]));
    const client = createLlmClient({
      config: baseConfig,
      rateLimiter,
      clock,
      anthropicClient: { messages: { create } } as never,
    });

    await client.analyzeDisclosure(baseInput());
    expect(acquireSpy).toHaveBeenCalledWith("LLM");
  });

  it("retries once on an envelope parse failure (missing tool_use block) then succeeds (R-7)", async () => {
    const { clock } = makeClock();
    const create = vi
      .fn()
      .mockResolvedValueOnce({ content: [{ type: "text", text: "no tool use here" }] })
      .mockResolvedValueOnce(toolUseResponse([]));
    const client = createLlmClient({
      config: baseConfig,
      rateLimiter: makeRateLimiter(clock),
      clock,
      anthropicClient: { messages: { create } } as never,
    });

    const outcome = await client.analyzeDisclosure(baseInput());
    expect(outcome.proposals).toEqual([]);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("returns an empty proposals array when the model reports no relevant changes", async () => {
    const { clock } = makeClock();
    const create = vi.fn().mockResolvedValue(toolUseResponse([]));
    const client = createLlmClient({
      config: baseConfig,
      rateLimiter: makeRateLimiter(clock),
      clock,
      anthropicClient: { messages: { create } } as never,
    });

    const outcome = await client.analyzeDisclosure(baseInput());
    expect(outcome.proposals).toEqual([]);
    expect(outcome.droppedItemCount).toBe(0);
  });

  it("drops invalid items but keeps valid ones from the same response", async () => {
    const { clock } = makeClock();
    const create = vi.fn().mockResolvedValue(
      toolUseResponse([
        {
          proposalType: "relation_add",
          sourceNodeAlias: "N1",
          targetNodeAlias: "N2",
          relationTypeAlias: "R1",
          rationale: "유효 항목",
        },
        { proposalType: "relation_add", sourceNodeAlias: "N99", targetNodeAlias: "N2", relationTypeAlias: "R1", rationale: "무효 항목" },
      ]),
    );
    const client = createLlmClient({
      config: baseConfig,
      rateLimiter: makeRateLimiter(clock),
      clock,
      anthropicClient: { messages: { create } } as never,
    });

    const outcome = await client.analyzeDisclosure(baseInput());
    expect(outcome.proposals).toHaveLength(1);
    expect(outcome.droppedItemCount).toBe(1);
  });

  it("throws LlmRequestError(kind='rate_limited') after retries are exhausted on a 429", async () => {
    const { clock } = makeClock();
    class FakeRateLimitError extends Error {
      readonly status = 429;
      readonly headers = new Headers();
    }
    const create = vi.fn().mockRejectedValue(new FakeRateLimitError("rate limited"));
    const client = createLlmClient({
      config: baseConfig,
      rateLimiter: makeRateLimiter(clock),
      clock,
      anthropicClient: { messages: { create } } as never,
    });

    await expect(client.analyzeDisclosure(baseInput())).rejects.toMatchObject({
      name: "LlmRequestError",
      kind: "rate_limited",
    });
  });

  it("throws LlmRequestError(kind='timeout') after retries are exhausted on a timeout", async () => {
    const { clock } = makeClock();
    class FakeTimeoutError extends Error {
      readonly name = "APIConnectionTimeoutError";
    }
    const create = vi.fn().mockRejectedValue(new FakeTimeoutError("timed out"));
    const client = createLlmClient({
      config: baseConfig,
      rateLimiter: makeRateLimiter(clock),
      clock,
      anthropicClient: { messages: { create } } as never,
    });

    await expect(client.analyzeDisclosure(baseInput())).rejects.toMatchObject({
      name: "LlmRequestError",
      kind: "timeout",
    });
  });

  it("throws LlmConfigError immediately (no retry) on a 401 authentication error", async () => {
    const { clock } = makeClock();
    class FakeAuthError extends Error {
      readonly status = 401;
    }
    const create = vi.fn().mockRejectedValue(new FakeAuthError("invalid api key"));
    const client = createLlmClient({
      config: baseConfig,
      rateLimiter: makeRateLimiter(clock),
      clock,
      anthropicClient: { messages: { create } } as never,
    });

    await expect(client.analyzeDisclosure(baseInput())).rejects.toBeInstanceOf(LlmConfigError);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("throws LlmRequestError(kind='server_error') after retries are exhausted on a 5xx", async () => {
    const { clock } = makeClock();
    class FakeServerError extends Error {
      readonly status = 500;
    }
    const create = vi.fn().mockRejectedValue(new FakeServerError("internal error"));
    const client = createLlmClient({
      config: baseConfig,
      rateLimiter: makeRateLimiter(clock),
      clock,
      anthropicClient: { messages: { create } } as never,
    });

    await expect(client.analyzeDisclosure(baseInput())).rejects.toBeInstanceOf(LlmRequestError);
  });
});
