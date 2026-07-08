import { describe, expect, it, vi } from "vitest";
import { createCollectQuotesJob, type CollectQuotesJobDeps } from "./collect-quotes.job";
import { TossAuthError } from "../adapters/tossinvest/contract";
import { repoFail, repoOk } from "../repositories/result";

const NOW = new Date("2026-07-06T01:00:00Z"); // 10:00 KST (개장 중), 21:00 America/New_York previous day (before_open)

function makeBatchLog() {
  return {
    start: vi.fn().mockResolvedValue("run-1"),
    finish: vi.fn().mockResolvedValue(undefined),
    itemFailures: vi.fn().mockResolvedValue(undefined),
    resolve: vi.fn().mockResolvedValue(undefined),
    unresolvedFailures: vi.fn().mockResolvedValue([]),
    isRunning: vi.fn().mockResolvedValue(false),
  };
}

function makeRepos(overrides: Partial<CollectQuotesJobDeps["repos"]> = {}): CollectQuotesJobDeps["repos"] {
  return {
    findCollectTargets: vi.fn().mockResolvedValue(repoOk([])),
    findByMarketDate: vi.fn().mockResolvedValue(repoOk(null)),
    upsertTicks: vi.fn().mockResolvedValue(repoOk({ upsertedChunks: 0 })),
    upsertProvisionalDaily: vi.fn().mockResolvedValue(repoOk(0)),
    findUnconfirmedDaily: vi.fn().mockResolvedValue(repoOk([])),
    upsertConfirmedDaily: vi.fn().mockResolvedValue(repoOk(undefined)),
    deleteExpiredTicks: vi.fn().mockResolvedValue(repoOk(0)),
    ...overrides,
  };
}

function makeToss(overrides: Partial<CollectQuotesJobDeps["toss"]> = {}): CollectQuotesJobDeps["toss"] {
  return {
    getPrices: vi.fn().mockResolvedValue({ quotes: [], failures: [], carriedOverSymbols: [] }),
    getConfirmedDailyCandle: vi.fn().mockResolvedValue(null),
    getStockInfos: vi.fn().mockResolvedValue({ infos: [], failures: [], carriedOverSymbols: [] }),
    getExchangeRate: vi.fn().mockResolvedValue({ kind: "not_published" }),
    getMarketCalendar: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const HOLIDAY_CALENDAR = repoOk({ isTradingDay: false, openAt: null, closeAt: null });

describe("collect-quotes job — E1 holiday / no targets", () => {
  it("makes no external calls and finishes success/processed 0 when both markets are on holiday", async () => {
    const batchLog = makeBatchLog();
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockResolvedValue(HOLIDAY_CALENDAR),
    });
    const toss = makeToss();
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(toss.getPrices).not.toHaveBeenCalled();
    expect(toss.getConfirmedDailyCandle).not.toHaveBeenCalled();
    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "success", processedCount: 0, failedCount: 0 }),
    );
  });
});

describe("collect-quotes job — BR-2 market scoping", () => {
  it("collects only KRX targets when KRX is open and US is before_open", async () => {
    const batchLog = makeBatchLog();
    const findByMarketDate = vi.fn().mockImplementation((market: string) => {
      if (market === "KRX") {
        return Promise.resolve(
          repoOk({
            isTradingDay: true,
            openAt: new Date("2026-07-06T00:00:00Z"),
            closeAt: new Date("2026-07-06T06:30:00Z"),
          }),
        );
      }
      // US before_open at NOW
      return Promise.resolve(
        repoOk({
          isTradingDay: true,
          openAt: new Date("2026-07-06T13:30:00Z"),
          closeAt: new Date("2026-07-06T20:00:00Z"),
        }),
      );
    });
    const findCollectTargets = vi.fn().mockResolvedValue(
      repoOk([{ id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" }]),
    );
    const repos = makeRepos({ findByMarketDate, findCollectTargets });
    const toss = makeToss({
      getPrices: vi.fn().mockResolvedValue({
        quotes: [{ symbol: "005930", price: 100, volume: 10, currency: "KRW" }],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(findCollectTargets).toHaveBeenCalledWith(["KRX"]);
    expect(toss.getPrices).toHaveBeenCalledWith(["005930"]);
  });
});

describe("collect-quotes job — E9 missing calendar", () => {
  it("skips KRX (unknown) and still collects US normally, ending partial_success with the skip reason logged", async () => {
    const batchLog = makeBatchLog();
    const findByMarketDate = vi.fn().mockImplementation((market: string) => {
      if (market === "KRX") return Promise.resolve(repoOk(null)); // E9: no calendar row
      return Promise.resolve(
        repoOk({
          isTradingDay: true,
          openAt: new Date("2026-07-06T00:00:00Z"),
          closeAt: new Date("2026-07-06T20:00:00Z"),
        }),
      );
    });
    const findCollectTargets = vi.fn().mockResolvedValue(
      repoOk([{ id: "sec-us", tossSymbol: "AAPL", market: "US", currency: "USD" }]),
    );
    const repos = makeRepos({ findByMarketDate, findCollectTargets });
    const toss = makeToss({
      getPrices: vi.fn().mockResolvedValue({
        quotes: [{ symbol: "AAPL", price: 200, volume: 5, currency: "USD" }],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(findCollectTargets).toHaveBeenCalledWith(["US"]);
    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "partial_success" }),
    );
    const [, summary] = batchLog.finish.mock.calls[0]!;
    expect(summary.errorLog).toMatch(/KRX/);
  });
});

describe("collect-quotes job — normal collection: ticks + provisional upsert", () => {
  const openCalendar = repoOk({
    isTradingDay: true,
    openAt: new Date("2026-07-06T00:00:00Z"),
    closeAt: new Date("2026-07-06T06:30:00Z"),
  });

  it("normalizes observed_at to the hour for every upserted tick row (BR-6)", async () => {
    const batchLog = makeBatchLog();
    const upsertTicks = vi.fn().mockResolvedValue(repoOk({ upsertedChunks: 1 }));
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(market === "KRX" ? openCalendar : repoOk(null)),
      ),
      findCollectTargets: vi.fn().mockResolvedValue(
        repoOk([{ id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" }]),
      ),
      upsertTicks,
    });
    const toss = makeToss({
      getPrices: vi.fn().mockResolvedValue({
        quotes: [{ symbol: "005930", price: 71500, volume: 100, currency: "KRW" }],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    // NOW has non-zero minutes to verify truncation.
    await job.run(new Date("2026-07-06T01:07:33Z"));

    const rows = upsertTicks.mock.calls[0]![0] as Array<{ observedAt: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.observedAt).toBe("2026-07-06T01:00:00.000Z");
  });

  it("calls upsertProvisionalDaily for each open market with the local trade date and UTC range (BR-5)", async () => {
    const batchLog = makeBatchLog();
    const upsertProvisionalDaily = vi.fn().mockResolvedValue(repoOk(1));
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(market === "KRX" ? openCalendar : repoOk(null)),
      ),
      findCollectTargets: vi.fn().mockResolvedValue(
        repoOk([{ id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" }]),
      ),
      upsertProvisionalDaily,
    });
    const toss = makeToss({
      getPrices: vi.fn().mockResolvedValue({
        quotes: [{ symbol: "005930", price: 100, volume: 10, currency: "KRW" }],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(upsertProvisionalDaily).toHaveBeenCalledWith(
      "KRX",
      "2026-07-06",
      new Date("2026-07-05T15:00:00Z"),
      new Date("2026-07-06T15:00:00Z"),
    );
  });

  it("records itemFailures and ends partial_success with failedCount=2 for 2 adapter failures (E4)", async () => {
    const batchLog = makeBatchLog();
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(market === "KRX" ? openCalendar : repoOk(null)),
      ),
      findCollectTargets: vi.fn().mockResolvedValue(
        repoOk([
          { id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" },
          { id: "sec-2", tossSymbol: "000660", market: "KRX", currency: "KRW" },
        ]),
      ),
    });
    const toss = makeToss({
      getPrices: vi.fn().mockResolvedValue({
        quotes: [],
        failures: [
          { symbol: "005930", reason: "not_found", message: "missing" },
          { symbol: "000660", reason: "validation_failed", message: "bad field" },
        ],
        carriedOverSymbols: [],
      }),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(batchLog.itemFailures).toHaveBeenCalledWith(
      "run-1",
      expect.arrayContaining([
        expect.objectContaining({ securityId: "sec-1" }),
        expect.objectContaining({ securityId: "sec-2" }),
      ]),
    );
    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "partial_success", failedCount: 2 }),
    );
  });

  it("marks isCarriedOver=true when carriedOverSymbols is non-empty (E3)", async () => {
    const batchLog = makeBatchLog();
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(market === "KRX" ? openCalendar : repoOk(null)),
      ),
      findCollectTargets: vi.fn().mockResolvedValue(
        repoOk([{ id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" }]),
      ),
    });
    const toss = makeToss({
      getPrices: vi.fn().mockResolvedValue({
        quotes: [],
        failures: [],
        carriedOverSymbols: ["005930"],
      }),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ isCarriedOver: true }),
    );
  });
});

describe("collect-quotes job — E10 confirmation step", () => {
  const afterCloseCalendar = repoOk({
    isTradingDay: true,
    openAt: new Date("2026-07-05T00:00:00Z"),
    closeAt: new Date("2026-07-05T06:30:00Z"),
  });

  it("upserts 1 confirmed candle and leaves the null one unconfirmed without recording a failure", async () => {
    const batchLog = makeBatchLog();
    const upsertConfirmedDaily = vi.fn().mockResolvedValue(repoOk(undefined));
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(market === "KRX" ? afterCloseCalendar : repoOk(null)),
      ),
      findUnconfirmedDaily: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(
          market === "KRX"
            ? repoOk([
                { securityId: "sec-1", tossSymbol: "005930" },
                { securityId: "sec-2", tossSymbol: "000660" },
              ])
            : repoOk([]),
        ),
      ),
      upsertConfirmedDaily,
    });
    const toss = makeToss({
      getConfirmedDailyCandle: vi.fn().mockImplementation((symbol: string) =>
        Promise.resolve(
          symbol === "005930"
            ? { symbol, date: "2026-07-06", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }
            : null,
        ),
      ),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(upsertConfirmedDaily).toHaveBeenCalledWith([
      expect.objectContaining({ securityId: "sec-1" }),
    ]);
    expect(batchLog.itemFailures).not.toHaveBeenCalledWith(
      "run-1",
      expect.arrayContaining([expect.objectContaining({ securityId: "sec-2" })]),
    );
  });

  it("skips the confirmation step entirely when there are 0 unconfirmed rows", async () => {
    const batchLog = makeBatchLog();
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(market === "KRX" ? afterCloseCalendar : repoOk(null)),
      ),
      findUnconfirmedDaily: vi.fn().mockResolvedValue(repoOk([])),
    });
    const toss = makeToss();
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(toss.getConfirmedDailyCandle).not.toHaveBeenCalled();
  });
});

describe("collect-quotes job — E5 auth failure", () => {
  it("finishes failed immediately and skips subsequent steps", async () => {
    const batchLog = makeBatchLog();
    const openCalendar = repoOk({
      isTradingDay: true,
      openAt: new Date("2026-07-06T00:00:00Z"),
      closeAt: new Date("2026-07-06T06:30:00Z"),
    });
    const deleteExpiredTicks = vi.fn().mockResolvedValue(repoOk(0));
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(market === "KRX" ? openCalendar : repoOk(null)),
      ),
      findCollectTargets: vi.fn().mockResolvedValue(
        repoOk([{ id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" }]),
      ),
      deleteExpiredTicks,
    });
    const toss = makeToss({
      getPrices: vi.fn().mockRejectedValue(new TossAuthError("token refresh failed")),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(deleteExpiredTicks).not.toHaveBeenCalled();
  });
});

describe("collect-quotes job — BR-7 unresolved failure resolution", () => {
  it("resolves previously-failed securities that succeed in this run", async () => {
    const batchLog = makeBatchLog();
    batchLog.unresolvedFailures.mockResolvedValue([{ id: "fail-1", securityId: "sec-1" }]);
    const openCalendar = repoOk({
      isTradingDay: true,
      openAt: new Date("2026-07-06T00:00:00Z"),
      closeAt: new Date("2026-07-06T06:30:00Z"),
    });
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(market === "KRX" ? openCalendar : repoOk(null)),
      ),
      findCollectTargets: vi.fn().mockResolvedValue(
        repoOk([{ id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" }]),
      ),
    });
    const toss = makeToss({
      getPrices: vi.fn().mockResolvedValue({
        quotes: [{ symbol: "005930", price: 100, volume: 10, currency: "KRW" }],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(batchLog.resolve).toHaveBeenCalledWith(["fail-1"]);
  });
});

describe("collect-quotes job — BR-4 cleanup step", () => {
  it("calls deleteExpiredTicks with a cutoff of baseHour - 30 days", async () => {
    const batchLog = makeBatchLog();
    const deleteExpiredTicks = vi.fn().mockResolvedValue(repoOk(5));
    const repos = makeRepos({ deleteExpiredTicks });
    const toss = makeToss();
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(new Date("2026-07-06T01:07:00Z"));

    expect(deleteExpiredTicks).toHaveBeenCalledWith(new Date("2026-06-06T01:00:00.000Z"));
  });
});

describe("collect-quotes job — repository failure", () => {
  it("finishes failed when tick upsert fails entirely", async () => {
    const batchLog = makeBatchLog();
    const openCalendar = repoOk({
      isTradingDay: true,
      openAt: new Date("2026-07-06T00:00:00Z"),
      closeAt: new Date("2026-07-06T06:30:00Z"),
    });
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockImplementation((market: string) =>
        Promise.resolve(market === "KRX" ? openCalendar : repoOk(null)),
      ),
      findCollectTargets: vi.fn().mockResolvedValue(
        repoOk([{ id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" }]),
      ),
      upsertTicks: vi.fn().mockResolvedValue(repoFail("db unavailable")),
    });
    const toss = makeToss({
      getPrices: vi.fn().mockResolvedValue({
        quotes: [{ symbol: "005930", price: 100, volume: 10, currency: "KRW" }],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await job.run(NOW);

    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
  });
});

describe("collect-quotes job — unexpected exception", () => {
  it("calls finish(failed) and does not propagate the exception", async () => {
    const batchLog = makeBatchLog();
    const repos = makeRepos({
      findByMarketDate: vi.fn().mockRejectedValue(new Error("unexpected crash")),
    });
    const toss = makeToss();
    const job = createCollectQuotesJob({ toss, batchLog, repos });

    await expect(job.run(NOW)).resolves.toBeUndefined();
    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
  });
});
