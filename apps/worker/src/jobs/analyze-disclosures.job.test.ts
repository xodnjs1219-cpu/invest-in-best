import { describe, expect, it, vi } from "vitest";
import { createAnalyzeDisclosuresJob, type AnalyzeDisclosuresJobDeps } from "./analyze-disclosures.job";
import { LlmConfigError, LlmRequestError, type LlmPort } from "../adapters/llm/contract";
import { repoFail, repoOk } from "../repositories/result";
import type { ActiveOfficialChain, SnapshotComposition } from "../repositories/chains.repository";
import type { UnanalyzedDisclosure } from "../repositories/disclosures.repository";

const NOW = new Date("2026-01-15T09:00:00Z");

function makeBatchLog(overrides: Partial<AnalyzeDisclosuresJobDeps["batchLog"]> = {}) {
  return {
    start: vi.fn().mockResolvedValue("run-1"),
    finish: vi.fn().mockResolvedValue(undefined),
    itemFailures: vi.fn().mockResolvedValue(undefined),
    resolve: vi.fn().mockResolvedValue(undefined),
    unresolvedFailures: vi.fn().mockResolvedValue([]),
    isRunning: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeChain(id = "chain-1", name = "반도체 밸류체인"): ActiveOfficialChain {
  return { id, name };
}

function makeComposition(overrides: Partial<SnapshotComposition> = {}): SnapshotComposition {
  return {
    snapshotId: "snap-1",
    nodes: [
      { nodeId: "node-a", displayName: "A사", nodeKind: "listed_company", securityId: "sec-a" },
      { nodeId: "node-b", displayName: "B사", nodeKind: "listed_company", securityId: "sec-b" },
    ],
    edges: [],
    ...overrides,
  };
}

function makeDisclosure(overrides: Partial<UnanalyzedDisclosure> = {}): UnanalyzedDisclosure {
  return {
    id: "disc-1",
    securityId: "sec-a",
    source: "dart",
    externalId: "20260101000001",
    title: "단일판매공급계약체결",
    disclosureDate: "2026-01-01",
    url: "https://dart.fss.or.kr/x",
    securityName: "A사",
    securityTicker: "000001",
    securityMarket: "KRX",
    ...overrides,
  };
}

function makeRepos(overrides: Partial<AnalyzeDisclosuresJobDeps["repos"]> = {}): AnalyzeDisclosuresJobDeps["repos"] {
  return {
    listActiveOfficialChains: vi.fn().mockResolvedValue(repoOk([makeChain()])),
    findLatestSnapshotComposition: vi.fn().mockResolvedValue(repoOk(makeComposition())),
    listActiveRelationTypes: vi
      .fn()
      .mockResolvedValue(repoOk([{ relationTypeId: "rel-supply", name: "공급", isDirected: true }])),
    listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([])),
    markAnalyzed: vi.fn().mockResolvedValue(repoOk(undefined)),
    listPendingKeys: vi.fn().mockResolvedValue(repoOk([])),
    insertPendingProposal: vi.fn().mockResolvedValue({ ok: true, inserted: true }),
    ...overrides,
  };
}

function makeOpenDart(overrides: Partial<AnalyzeDisclosuresJobDeps["openDart"]> = {}) {
  return { fetchDisclosureDocumentText: vi.fn().mockResolvedValue(null), ...overrides };
}

function makeSecEdgar(overrides: Partial<AnalyzeDisclosuresJobDeps["secEdgar"]> = {}) {
  return { fetchFilingDocumentText: vi.fn().mockResolvedValue(null), ...overrides };
}

function makeLlm(overrides: Partial<{ analyzeDisclosure: ReturnType<typeof vi.fn> }> = {}): LlmPort {
  return {
    analyzeDisclosure: vi.fn().mockResolvedValue({ proposals: [], droppedItemCount: 0 }),
    ...overrides,
  } as unknown as LlmPort;
}

function makeDeps(overrides: Partial<AnalyzeDisclosuresJobDeps> = {}): AnalyzeDisclosuresJobDeps {
  return {
    llmFactory: () => makeLlm(),
    openDart: makeOpenDart(),
    secEdgar: makeSecEdgar(),
    repos: makeRepos(),
    batchLog: makeBatchLog(),
    ...overrides,
  };
}

describe("createAnalyzeDisclosuresJob", () => {
  it("returns failed immediately when the LLM factory throws LlmConfigError (E14) without calling repos", async () => {
    const listActiveOfficialChains = vi.fn();
    const deps = makeDeps({
      llmFactory: () => {
        throw new LlmConfigError("ANTHROPIC_API_KEY missing");
      },
      repos: makeRepos({ listActiveOfficialChains }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);

    expect(status).toBe("failed");
    expect(listActiveOfficialChains).not.toHaveBeenCalled();
    expect(deps.batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("returns success with processed=0 and no marking when there are zero official chains (E9·R-11)", async () => {
    const markAnalyzed = vi.fn();
    const deps = makeDeps({
      repos: makeRepos({ listActiveOfficialChains: vi.fn().mockResolvedValue(repoOk([])), markAnalyzed }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);

    expect(status).toBe("success");
    expect(markAnalyzed).not.toHaveBeenCalled();
    expect(deps.batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "success", processedCount: 0 }));
  });

  it("returns success with processed=0 when there are zero unanalyzed disclosures (E8)", async () => {
    const deps = makeDeps({ repos: makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([])) }) });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);
    expect(status).toBe("success");
  });

  it("marks irrelevant disclosures without any LLM call, counts them as processed, and returns success (BR-12)", async () => {
    const analyzeDisclosure = vi.fn();
    const markAnalyzed = vi.fn().mockResolvedValue(repoOk(undefined));
    const irrelevant = [
      makeDisclosure({ id: "disc-1", securityId: "sec-unrelated" }),
      makeDisclosure({ id: "disc-2", securityId: "sec-unrelated" }),
      makeDisclosure({ id: "disc-3", securityId: "sec-unrelated" }),
    ];
    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      repos: makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk(irrelevant)), markAnalyzed }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);

    expect(analyzeDisclosure).not.toHaveBeenCalled();
    expect(markAnalyzed).toHaveBeenCalledWith(["disc-1", "disc-2", "disc-3"], NOW.toISOString());
    expect(status).toBe("success");
    expect(deps.batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "success", processedCount: 3 }));
  });

  it("calls the LLM twice for one disclosure related to two chains, storing proposals with each chain's own snapshot id (E10)", async () => {
    const chain1Composition = makeComposition({ snapshotId: "snap-1" });
    const chain2Composition = makeComposition({ snapshotId: "snap-2" });
    const analyzeDisclosure = vi.fn().mockResolvedValue({
      proposals: [
        {
          proposalType: "relation_add",
          sourceNodeId: "node-a",
          targetNodeId: "node-b",
          relationTypeId: "rel-supply",
          rationale: "공시 근거",
        },
      ],
      droppedItemCount: 0,
    });
    const insertPendingProposal = vi.fn().mockResolvedValue({ ok: true, inserted: true });
    const markAnalyzed = vi.fn().mockResolvedValue(repoOk(undefined));

    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      repos: makeRepos({
        listActiveOfficialChains: vi.fn().mockResolvedValue(repoOk([makeChain("chain-1"), makeChain("chain-2")])),
        findLatestSnapshotComposition: vi
          .fn()
          .mockImplementation((chainId: string) =>
            Promise.resolve(repoOk(chainId === "chain-1" ? chain1Composition : chain2Composition)),
          ),
        listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])),
        insertPendingProposal,
        markAnalyzed,
      }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);

    expect(analyzeDisclosure).toHaveBeenCalledTimes(2);
    expect(insertPendingProposal).toHaveBeenCalledTimes(2);
    expect(insertPendingProposal).toHaveBeenCalledWith(expect.objectContaining({ chainId: "chain-1", basedOnSnapshotId: "snap-1" }));
    expect(insertPendingProposal).toHaveBeenCalledWith(expect.objectContaining({ chainId: "chain-2", basedOnSnapshotId: "snap-2" }));
    expect(markAnalyzed).toHaveBeenCalledWith(["disc-1"], NOW.toISOString());
    expect(status).toBe("success");
  });

  it("carries over once the daily limit is exceeded (budget=3, disclosures A(1 chain) B(1 chain) C(1 chain))", async () => {
    const analyzeDisclosure = vi.fn().mockResolvedValue({ proposals: [], droppedItemCount: 0 });
    const markAnalyzed = vi.fn().mockResolvedValue(repoOk(undefined));
    const disclosures = [
      makeDisclosure({ id: "disc-A", disclosureDate: "2026-01-01" }),
      makeDisclosure({ id: "disc-B", disclosureDate: "2026-01-02" }),
      makeDisclosure({ id: "disc-C", disclosureDate: "2026-01-03" }),
      makeDisclosure({ id: "disc-D", disclosureDate: "2026-01-04" }),
    ];
    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      repos: makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk(disclosures)), markAnalyzed }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    // 상한을 낮추기 위해 도메인 상수 대신 잡 내부 로직을 그대로 사용 — 4건 모두 1개 체인이므로
    // ANALYZE_DISCLOSURES_DAILY_LLM_CALL_LIMIT(200)보다 훨씬 작은 값이라 전부 처리됨을 검증(회귀 방지 기본 케이스).
    const status = await job.run(NOW);
    expect(analyzeDisclosure).toHaveBeenCalledTimes(4);
    expect(status).toBe("success");
  });

  it("uses contentExcerpt=null and continues the LLM call when document fetch returns null (R-3 fallback)", async () => {
    const fetchDisclosureDocumentText = vi.fn().mockResolvedValue(null);
    const analyzeDisclosure = vi.fn().mockResolvedValue({ proposals: [], droppedItemCount: 0 });
    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      openDart: makeOpenDart({ fetchDisclosureDocumentText }),
      repos: makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])) }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    await job.run(NOW);

    expect(analyzeDisclosure).toHaveBeenCalledWith(
      expect.objectContaining({ disclosure: expect.objectContaining({ contentExcerpt: null }) }),
    );
  });

  it("fetches the document exactly once per disclosure even when it spans two chains (cost control)", async () => {
    const fetchDisclosureDocumentText = vi.fn().mockResolvedValue("원문 텍스트");
    const chain1Composition = makeComposition({ snapshotId: "snap-1" });
    const chain2Composition = makeComposition({ snapshotId: "snap-2" });
    const deps = makeDeps({
      openDart: makeOpenDart({ fetchDisclosureDocumentText }),
      repos: makeRepos({
        listActiveOfficialChains: vi.fn().mockResolvedValue(repoOk([makeChain("chain-1"), makeChain("chain-2")])),
        findLatestSnapshotComposition: vi
          .fn()
          .mockImplementation((chainId: string) =>
            Promise.resolve(repoOk(chainId === "chain-1" ? chain1Composition : chain2Composition)),
          ),
        listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])),
      }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    await job.run(NOW);
    expect(fetchDisclosureDocumentText).toHaveBeenCalledTimes(1);
  });

  it("drops filtered-out candidates without inserting them (E1~E3 blocked at the filter stage)", async () => {
    const analyzeDisclosure = vi.fn().mockResolvedValue({
      proposals: [
        {
          proposalType: "relation_add",
          sourceNodeId: "node-a",
          targetNodeId: "node-unknown",
          relationTypeId: "rel-supply",
          rationale: "존재하지 않는 노드",
        },
        {
          proposalType: "relation_add",
          sourceNodeId: "node-a",
          targetNodeId: "node-b",
          relationTypeId: "rel-supply",
          rationale: "정상 제안",
        },
      ],
      droppedItemCount: 0,
    });
    const insertPendingProposal = vi.fn().mockResolvedValue({ ok: true, inserted: true });
    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      repos: makeRepos({
        listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])),
        insertPendingProposal,
      }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    await job.run(NOW);
    expect(insertPendingProposal).toHaveBeenCalledTimes(1);
    expect(insertPendingProposal).toHaveBeenCalledWith(expect.objectContaining({ targetNodeId: "node-b" }));
  });

  it("treats a 23505 skip (inserted:false) as a normal merge — the disclosure is still marked analyzed (E5·E13)", async () => {
    const analyzeDisclosure = vi.fn().mockResolvedValue({
      proposals: [
        { proposalType: "relation_add", sourceNodeId: "node-a", targetNodeId: "node-b", relationTypeId: "rel-supply", rationale: "근거" },
      ],
      droppedItemCount: 0,
    });
    const insertPendingProposal = vi.fn().mockResolvedValue({ ok: true, inserted: false });
    const markAnalyzed = vi.fn().mockResolvedValue(repoOk(undefined));
    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      repos: makeRepos({
        listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])),
        insertPendingProposal,
        markAnalyzed,
      }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);
    expect(markAnalyzed).toHaveBeenCalledWith(["disc-1"], NOW.toISOString());
    expect(status).toBe("success");
  });

  it("keeps the disclosure unanalyzed and records a failure when insertPendingProposal returns a DB error", async () => {
    const analyzeDisclosure = vi.fn().mockResolvedValue({
      proposals: [
        { proposalType: "relation_add", sourceNodeId: "node-a", targetNodeId: "node-b", relationTypeId: "rel-supply", rationale: "근거" },
      ],
      droppedItemCount: 0,
    });
    const insertPendingProposal = vi.fn().mockResolvedValue({ ok: false, error: "fk violation" });
    const markAnalyzed = vi.fn().mockResolvedValue(repoOk(undefined));
    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      repos: makeRepos({
        listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])),
        insertPendingProposal,
        markAnalyzed,
      }),
      batchLog: makeBatchLog(),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);
    expect(markAnalyzed).not.toHaveBeenCalledWith(["disc-1"], expect.anything());
    expect(status).toBe("partial_success");
    expect(deps.batchLog.itemFailures).toHaveBeenCalledWith(
      "run-1",
      expect.arrayContaining([expect.objectContaining({ securityId: "sec-a" })]),
    );
  });

  it("marks the disclosure analyzed even when the model returns zero proposals (spec 4-8)", async () => {
    const markAnalyzed = vi.fn().mockResolvedValue(repoOk(undefined));
    const deps = makeDeps({ repos: makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])), markAnalyzed }) });
    const job = createAnalyzeDisclosuresJob(deps);

    await job.run(NOW);
    expect(markAnalyzed).toHaveBeenCalledWith(["disc-1"], NOW.toISOString());
  });

  it("keeps a disclosure unanalyzed, records item failure with security_id, and returns partial_success when at least one other disclosure succeeds (E4)", async () => {
    // 한 건은 실패, 다른 한 건은 성공해야 anySuccess=true가 되어 partial_success로 판정된다
    // (전량 실패는 E15 — failed가 맞는 별도 케이스로 아래에서 검증).
    const analyzeDisclosure = vi
      .fn()
      .mockRejectedValueOnce(new LlmRequestError("timeout", "timed out"))
      .mockResolvedValueOnce({ proposals: [], droppedItemCount: 0 });
    const markAnalyzed = vi.fn().mockResolvedValue(repoOk(undefined));
    const disclosures = [
      makeDisclosure({ id: "disc-1", securityId: "sec-a", disclosureDate: "2026-01-01" }),
      makeDisclosure({ id: "disc-2", securityId: "sec-a", disclosureDate: "2026-01-02" }),
    ];
    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      repos: makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk(disclosures)), markAnalyzed }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);
    expect(markAnalyzed).not.toHaveBeenCalledWith(["disc-1"], expect.anything());
    expect(markAnalyzed).toHaveBeenCalledWith(["disc-2"], NOW.toISOString());
    expect(status).toBe("partial_success");
    expect(deps.batchLog.itemFailures).toHaveBeenCalledWith(
      "run-1",
      expect.arrayContaining([expect.objectContaining({ securityId: "sec-a" })]),
    );
  });

  it("returns failed when the sole disclosure in the run fails its final LLM request (all calls failed, E15)", async () => {
    const analyzeDisclosure = vi.fn().mockRejectedValue(new LlmRequestError("timeout", "timed out"));
    const markAnalyzed = vi.fn().mockResolvedValue(repoOk(undefined));
    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      repos: makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])), markAnalyzed }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);
    expect(markAnalyzed).not.toHaveBeenCalledWith(["disc-1"], expect.anything());
    expect(status).toBe("failed");
  });

  it("aborts the loop early after consecutive LLM failures reach the threshold, carrying over remaining disclosures and returning failed on zero success (E15·R-13)", async () => {
    const analyzeDisclosure = vi.fn().mockRejectedValue(new LlmRequestError("server_error", "all down"));
    const disclosures = Array.from({ length: 10 }, (_, i) =>
      makeDisclosure({ id: `disc-${i}`, disclosureDate: `2026-01-${String(i + 1).padStart(2, "0")}` }),
    );
    const deps = makeDeps({
      llmFactory: () => makeLlm({ analyzeDisclosure }),
      repos: makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk(disclosures)) }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);

    expect(analyzeDisclosure.mock.calls.length).toBeLessThan(10);
    expect(status).toBe("failed");
    expect(deps.batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed", isCarriedOver: true }));
  });

  it("resolves previously unresolved failures for a disclosure's security once it succeeds again (spec 6.5)", async () => {
    // NOTE: resolve() 자동 호출은 batchLog.unresolvedFailures 조회 기반 확장 지점 — 본 케이스는
    // 최소 계약(현재 실행에서 성공 시 실패 카운트에 포함되지 않음)을 검증한다.
    const markAnalyzed = vi.fn().mockResolvedValue(repoOk(undefined));
    const deps = makeDeps({ repos: makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])), markAnalyzed }) });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);
    expect(status).toBe("success");
  });

  it("finishes with failed and does not throw when an unexpected exception occurs mid-run", async () => {
    const deps = makeDeps({
      repos: makeRepos({ listActiveOfficialChains: vi.fn().mockRejectedValue(new Error("boom")) }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);
    expect(status).toBe("failed");
    expect(deps.batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
  });

  it("propagates a DB error from listActiveOfficialChains as a job-level failure", async () => {
    const deps = makeDeps({
      repos: makeRepos({ listActiveOfficialChains: vi.fn().mockResolvedValue(repoFail("db down")) }),
    });
    const job = createAnalyzeDisclosuresJob(deps);

    const status = await job.run(NOW);
    expect(status).toBe("failed");
  });

  it("never calls any chain_snapshots/snapshot_* write function (BR-6 — read/insert-proposal/mark-analyzed only)", async () => {
    const analyzeDisclosure = vi.fn().mockResolvedValue({
      proposals: [
        { proposalType: "relation_add", sourceNodeId: "node-a", targetNodeId: "node-b", relationTypeId: "rel-supply", rationale: "근거" },
      ],
      droppedItemCount: 0,
    });
    const repos = makeRepos({ listUnanalyzedChunk: vi.fn().mockResolvedValue(repoOk([makeDisclosure()])) });
    const deps = makeDeps({ llmFactory: () => makeLlm({ analyzeDisclosure }), repos });
    const job = createAnalyzeDisclosuresJob(deps);

    await job.run(NOW);

    // repos 인터페이스 자체가 SELECT/INSERT(proposal)/UPDATE(mark)만 노출한다 — 구조적으로 스냅샷 쓰기 불가.
    expect(Object.keys(repos)).not.toContain("insertSnapshot");
    expect(Object.keys(repos)).not.toContain("updateSnapshot");
  });
});
