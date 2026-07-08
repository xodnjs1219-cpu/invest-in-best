import { describe, expect, it, vi } from "vitest";
import { createPhase0SeedSecurities } from "./phase0-seed-securities";
import { repoOk } from "../../repositories/result";
import { PHASE0_SEED_CHECKPOINT_KEY } from "./checkpoint-plan";

function makeDart(overrides: Record<string, unknown> = {}) {
  return {
    fetchCorpCodeMappings: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeSec(overrides: Record<string, unknown> = {}) {
  return {
    fetchTickerCikMap: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeToss(overrides: Record<string, unknown> = {}) {
  return {
    getStocks: vi.fn().mockResolvedValue({ stocks: [], failures: [], carriedOverSymbols: [] }),
    ...overrides,
  };
}

function makeRepos(overrides: Record<string, unknown> = {}) {
  return {
    upsertSecuritySeeds: vi.fn().mockResolvedValue(repoOk(undefined)),
    upsertShares: vi.fn().mockResolvedValue(repoOk(undefined)),
    findAllTickers: vi.fn().mockResolvedValue(repoOk([])),
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

describe("phase0-seed-securities — fresh run", () => {
  it("proceeds dart -> sec -> toss in order, advancing the cursor at each step", async () => {
    const dart = makeDart({
      fetchCorpCodeMappings: vi.fn().mockResolvedValue([
        { corpCode: "00126380", stockCode: "005930", corpName: "삼성전자", modifyDate: "20260101" },
      ]),
    });
    const sec = makeSec({
      fetchTickerCikMap: vi.fn().mockResolvedValue([{ cik: "0000320193", ticker: "AAPL", title: "Apple Inc." }]),
    });
    const toss = makeToss({
      getStocks: vi.fn().mockResolvedValue({
        stocks: [{ symbol: "005930", name: "삼성전자", englishName: null, status: "active", sharesOutstanding: 100, listDate: null, delistDate: null, isinCode: null, securityType: null }],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const repos = makeRepos({
      findAllTickers: vi.fn().mockResolvedValue(repoOk([{ market: "KRX", ticker: "005930" }])),
    });
    const checkpoints = makeCheckpoints();
    const guard = makeGuard();

    const phase0 = createPhase0SeedSecurities({ dart, sec, toss, repos, checkpoints, guard });
    await phase0.run();

    expect(dart.fetchCorpCodeMappings).toHaveBeenCalledTimes(1);
    expect(sec.fetchTickerCikMap).toHaveBeenCalledTimes(1);
    expect(toss.getStocks).toHaveBeenCalledTimes(1);
    expect(repos.upsertSecuritySeeds).toHaveBeenCalled();
    // Final completion marks the checkpoint done.
    expect(checkpoints.complete).toHaveBeenCalledWith(PHASE0_SEED_CHECKPOINT_KEY);
  });

  it("upserts KRX seed rows without toss_symbol/cik keys (cross-source contamination guard)", async () => {
    const dart = makeDart({
      fetchCorpCodeMappings: vi.fn().mockResolvedValue([
        { corpCode: "00126380", stockCode: "005930", corpName: "삼성전자", modifyDate: "20260101" },
      ]),
    });
    const repos = makeRepos();
    const phase0 = createPhase0SeedSecurities({
      dart,
      sec: makeSec(),
      toss: makeToss(),
      repos,
      checkpoints: makeCheckpoints(),
      guard: makeGuard(),
    });

    await phase0.run();

    const dartCall = (repos.upsertSecuritySeeds as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(dartCall[0]).not.toHaveProperty("toss_symbol");
    expect(dartCall[0]).not.toHaveProperty("cik");
    expect(dartCall[0]).toMatchObject({ market: "KRX", ticker: "005930", dartCorpCode: "00126380" });
  });

  it("seeds shares_outstanding(source=toss) only for symbols with sharesOutstanding present", async () => {
    const toss = makeToss({
      getStocks: vi.fn().mockResolvedValue({
        stocks: [
          { symbol: "005930", name: "삼성전자", englishName: null, status: "active", sharesOutstanding: 5919637922, listDate: null, delistDate: null, isinCode: null, securityType: null },
          { symbol: "000660", name: "SK하이닉스", englishName: null, status: "active", sharesOutstanding: null, listDate: null, delistDate: null, isinCode: null, securityType: null },
        ],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const repos = makeRepos({
      findAllTickers: vi.fn().mockResolvedValue(
        repoOk([
          { market: "KRX", ticker: "005930", id: "sec-1" },
          { market: "KRX", ticker: "000660", id: "sec-2" },
        ]),
      ),
    });
    const phase0 = createPhase0SeedSecurities({
      dart: makeDart(),
      sec: makeSec(),
      toss,
      repos,
      checkpoints: makeCheckpoints(),
      guard: makeGuard(),
    });

    await phase0.run();

    expect(repos.upsertShares).toHaveBeenCalledWith([
      expect.objectContaining({ securityId: "sec-1", shares: 5919637922, source: "toss" }),
    ]);
  });

  it("skips all external calls and completes instantly when the checkpoint is already completed", async () => {
    const dart = makeDart();
    const sec = makeSec();
    const toss = makeToss();
    const checkpoints = makeCheckpoints({
      get: vi.fn().mockResolvedValue(repoOk({ cursor: { step: "toss", tossChunkIndex: 0 }, isCompleted: true })),
    });

    const phase0 = createPhase0SeedSecurities({
      dart,
      sec,
      toss,
      repos: makeRepos(),
      checkpoints,
      guard: makeGuard(),
    });
    await phase0.run();

    expect(dart.fetchCorpCodeMappings).not.toHaveBeenCalled();
    expect(sec.fetchTickerCikMap).not.toHaveBeenCalled();
    expect(toss.getStocks).not.toHaveBeenCalled();
  });

  it("resumes from cursor.step='toss' without re-calling dart/sec", async () => {
    const dart = makeDart();
    const sec = makeSec();
    const toss = makeToss();
    const checkpoints = makeCheckpoints({
      get: vi.fn().mockResolvedValue(
        repoOk({ cursor: { step: "toss", tossChunkIndex: 0 }, isCompleted: false }),
      ),
    });
    const repos = makeRepos({
      findAllTickers: vi.fn().mockResolvedValue(repoOk([{ market: "KRX", ticker: "005930" }])),
    });

    const phase0 = createPhase0SeedSecurities({ dart, sec, toss, repos, checkpoints, guard: makeGuard() });
    await phase0.run();

    expect(dart.fetchCorpCodeMappings).not.toHaveBeenCalled();
    expect(sec.fetchTickerCikMap).not.toHaveBeenCalled();
    expect(toss.getStocks).toHaveBeenCalled();
  });
});
