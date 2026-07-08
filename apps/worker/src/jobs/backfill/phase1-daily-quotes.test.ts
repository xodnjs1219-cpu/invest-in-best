import { describe, expect, it, vi } from "vitest";
import { createPhase1DailyQuotes } from "./phase1-daily-quotes";
import { repoOk } from "../../repositories/result";
import { TossAuthError, TossRequestError } from "../../adapters/tossinvest/contract";
import { candlesCheckpointKey } from "./checkpoint-plan";

function makeToss(overrides: Record<string, unknown> = {}) {
  return {
    getDailyCandlesPage: vi.fn().mockResolvedValue({ candles: [], nextBefore: null }),
    ...overrides,
  };
}

function makeRepos(overrides: Record<string, unknown> = {}) {
  return {
    upsertConfirmedDaily: vi.fn().mockResolvedValue(repoOk(undefined)),
    ...overrides,
  };
}

function makeCheckpoints(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue(repoOk(null)),
    upsert: vi.fn().mockResolvedValue(repoOk(undefined)),
    complete: vi.fn().mockResolvedValue(repoOk(undefined)),
    ...overrides,
  };
}

function makeGuard() {
  return { waitUntilIdle: vi.fn().mockResolvedValue(undefined) };
}

function makeBatchLog() {
  return { itemFailures: vi.fn().mockResolvedValue(undefined) };
}

const fastRetryOptions = { retries: 1, sleep: () => Promise.resolve() };

const targets = [{ id: "sec-1", tossSymbol: "005930", market: "KRX" as const }];

describe("phase1-daily-quotes — pagination & completion", () => {
  it("paginates 3 pages (200/200/37), upserting each and advancing the cursor, then completes", async () => {
    const toss = makeToss({
      getDailyCandlesPage: vi
        .fn()
        .mockResolvedValueOnce({ candles: Array(200).fill({ symbol: "005930", date: "2026-07-06", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }), nextBefore: "b1" })
        .mockResolvedValueOnce({ candles: Array(200).fill({ symbol: "005930", date: "2026-07-05", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }), nextBefore: "b2" })
        .mockResolvedValueOnce({ candles: Array(37).fill({ symbol: "005930", date: "2026-07-04", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }), nextBefore: null }),
    });
    const repos = makeRepos();
    const checkpoints = makeCheckpoints();

    const phase1 = createPhase1DailyQuotes({ toss, repos, checkpoints, guard: makeGuard(), batchLog: makeBatchLog() });
    await phase1.run(targets);

    expect(repos.upsertConfirmedDaily).toHaveBeenCalledTimes(3);
    expect(checkpoints.upsert).toHaveBeenCalledWith(candlesCheckpointKey("sec-1"), { before: "b1" }, false);
    expect(checkpoints.upsert).toHaveBeenCalledWith(candlesCheckpointKey("sec-1"), { before: "b2" }, false);
    expect(checkpoints.complete).toHaveBeenCalledWith(candlesCheckpointKey("sec-1"));
  });

  it("completes immediately on the first page when nextBefore is null (E7)", async () => {
    const toss = makeToss({
      getDailyCandlesPage: vi.fn().mockResolvedValue({
        candles: [{ symbol: "005930", date: "2026-07-06", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
        nextBefore: null,
      }),
    });
    const repos = makeRepos();
    const checkpoints = makeCheckpoints();

    const phase1 = createPhase1DailyQuotes({ toss, repos, checkpoints, guard: makeGuard(), batchLog: makeBatchLog() });
    await phase1.run(targets);

    expect(repos.upsertConfirmedDaily).toHaveBeenCalledTimes(1);
    expect(checkpoints.complete).toHaveBeenCalledWith(candlesCheckpointKey("sec-1"));
  });

  it("completes without any upsert for an empty first page (new listing, E2)", async () => {
    const toss = makeToss({ getDailyCandlesPage: vi.fn().mockResolvedValue({ candles: [], nextBefore: null }) });
    const repos = makeRepos();
    const checkpoints = makeCheckpoints();

    const phase1 = createPhase1DailyQuotes({ toss, repos, checkpoints, guard: makeGuard(), batchLog: makeBatchLog() });
    await phase1.run(targets);

    expect(repos.upsertConfirmedDaily).not.toHaveBeenCalled();
    expect(checkpoints.complete).toHaveBeenCalledWith(candlesCheckpointKey("sec-1"));
  });

  it("does not advance the cursor when the upsert fails (cursor-persistence consistency, BR-6)", async () => {
    const toss = makeToss({
      getDailyCandlesPage: vi.fn().mockResolvedValue({
        candles: [{ symbol: "005930", date: "2026-07-06", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
        nextBefore: "b1",
      }),
    });
    const repos = makeRepos({
      upsertConfirmedDaily: vi.fn().mockResolvedValue({ ok: false, error: "db down" }),
    });
    const checkpoints = makeCheckpoints();

    const phase1 = createPhase1DailyQuotes({ toss, repos, checkpoints, guard: makeGuard(), batchLog: makeBatchLog() });
    await phase1.run(targets);

    expect(checkpoints.upsert).not.toHaveBeenCalledWith(candlesCheckpointKey("sec-1"), { before: "b1" }, false);
    expect(checkpoints.complete).not.toHaveBeenCalledWith(candlesCheckpointKey("sec-1"));
  });

  it("carries over security A on persistent 429 (isolated, E8) while continuing to process security B", async () => {
    const twoTargets = [
      { id: "sec-a", tossSymbol: "AAA", market: "KRX" as const },
      { id: "sec-b", tossSymbol: "BBB", market: "KRX" as const },
    ];
    const toss = makeToss({
      getDailyCandlesPage: vi.fn().mockImplementation((symbol: string) => {
        if (symbol === "AAA") {
          return Promise.reject(new TossRequestError({ code: "rate-limit-exceeded", status: 429, message: "too many" }));
        }
        return Promise.resolve({ candles: [], nextBefore: null });
      }),
    });
    const repos = makeRepos();
    const checkpoints = makeCheckpoints();

    const phase1 = createPhase1DailyQuotes({
      toss,
      repos,
      checkpoints,
      guard: makeGuard(),
      batchLog: makeBatchLog(),
      retryOptions: fastRetryOptions,
    });
    const summary = await phase1.run(twoTargets);

    expect(checkpoints.complete).toHaveBeenCalledWith(candlesCheckpointKey("sec-b"));
    expect(checkpoints.complete).not.toHaveBeenCalledWith(candlesCheckpointKey("sec-a"));
    expect(summary.carriedOver).toBe(true);
  });

  it("propagates TossAuthError so the caller can mark Phase 1 as carried over without processing remaining securities", async () => {
    const toss = makeToss({ getDailyCandlesPage: vi.fn().mockRejectedValue(new TossAuthError("token refresh failed")) });
    const repos = makeRepos();
    const checkpoints = makeCheckpoints();

    const phase1 = createPhase1DailyQuotes({ toss, repos, checkpoints, guard: makeGuard(), batchLog: makeBatchLog() });
    const summary = await phase1.run(targets);

    expect(summary.authFailed).toBe(true);
    expect(checkpoints.complete).not.toHaveBeenCalled();
  });

  it("skips securities whose checkpoint is already completed (resume, E1)", async () => {
    const toss = makeToss();
    const checkpoints = makeCheckpoints({
      get: vi.fn().mockResolvedValue(repoOk({ cursor: { before: null }, isCompleted: true })),
    });

    const phase1 = createPhase1DailyQuotes({ toss, repos: makeRepos(), checkpoints, guard: makeGuard(), batchLog: makeBatchLog() });
    await phase1.run(targets);

    expect(toss.getDailyCandlesPage).not.toHaveBeenCalled();
  });
});
