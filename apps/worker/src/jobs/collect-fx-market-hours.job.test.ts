import { describe, expect, it, vi } from "vitest";
import { createCollectFxMarketHoursJob, type CollectFxMarketHoursJobDeps } from "./collect-fx-market-hours.job";
import { TossAuthError } from "../adapters/tossinvest/contract";
import { repoFail, repoOk } from "../repositories/result";

const NOW = new Date("2026-07-07T23:30:00Z"); // 08:30 KST 실행 시각

function makeBatchLog(overrides: Partial<CollectFxMarketHoursJobDeps["batchLog"]> = {}): CollectFxMarketHoursJobDeps["batchLog"] {
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

function makeToss(overrides: Partial<CollectFxMarketHoursJobDeps["toss"]> = {}): CollectFxMarketHoursJobDeps["toss"] {
  return {
    getExchangeRate: vi.fn().mockResolvedValue({
      kind: "ok",
      rate: { baseCurrency: "USD", quoteCurrency: "KRW", rate: 1350.5, rateDate: "2026-07-08" },
    }),
    getMarketCalendar: vi.fn().mockResolvedValue([
      { market: "KRX", calendarDate: "2026-07-08", isTradingDay: true, openAt: new Date(), closeAt: new Date(), isEarlyClose: false },
    ]),
    ...overrides,
  };
}

function makeFxRepo(overrides: Partial<CollectFxMarketHoursJobDeps["fxRepo"]> = {}): CollectFxMarketHoursJobDeps["fxRepo"] {
  return {
    upsertRate: vi.fn().mockResolvedValue(repoOk(undefined)),
    findLatestRate: vi.fn().mockResolvedValue(repoOk(null)),
    ...overrides,
  };
}

function makeCalendarRepo(
  overrides: Partial<CollectFxMarketHoursJobDeps["calendarRepo"]> = {},
): CollectFxMarketHoursJobDeps["calendarRepo"] {
  return {
    upsertDays: vi.fn().mockImplementation((rows: unknown[]) => Promise.resolve(repoOk({ count: rows.length }))),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CollectFxMarketHoursJobDeps> = {}): CollectFxMarketHoursJobDeps {
  return {
    toss: makeToss(),
    fxRepo: makeFxRepo(),
    calendarRepo: makeCalendarRepo(),
    batchLog: makeBatchLog(),
    ...overrides,
  };
}

describe("collect-fx-market-hours job — full success", () => {
  it("processes fx + KR + US calendar steps, reports success with the summed processed count", async () => {
    const toss = makeToss({
      getMarketCalendar: vi.fn().mockImplementation((market: string) =>
        Promise.resolve([
          { market, calendarDate: "2026-07-08", isTradingDay: true, openAt: new Date(), closeAt: new Date(), isEarlyClose: false },
          { market, calendarDate: "2026-07-09", isTradingDay: true, openAt: new Date(), closeAt: new Date(), isEarlyClose: false },
        ]),
      ),
    });
    const batchLog = makeBatchLog();
    const job = createCollectFxMarketHoursJob(makeDeps({ toss, batchLog }));

    await job.run(NOW);

    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "success", processedCount: 5, failedCount: 0 }),
    );
  });
});

describe("collect-fx-market-hours job — fx not_published (spec Edge: 결측 허용)", () => {
  it("treats 404 as success with 0 fx rows and does not call upsertRate", async () => {
    const toss = makeToss({ getExchangeRate: vi.fn().mockResolvedValue({ kind: "not_published" }) });
    const fxRepo = makeFxRepo();
    const job = createCollectFxMarketHoursJob(makeDeps({ toss, fxRepo }));

    await job.run(NOW);

    expect(fxRepo.upsertRate).not.toHaveBeenCalled();
    const [, summary] = (fxRepo as unknown as { upsertRate: ReturnType<typeof vi.fn> }).upsertRate.mock.calls[0] ?? [];
    void summary;
  });

  it("still reports success overall when fx is not_published but calendars succeed", async () => {
    const toss = makeToss({ getExchangeRate: vi.fn().mockResolvedValue({ kind: "not_published" }) });
    const batchLog = makeBatchLog();
    const job = createCollectFxMarketHoursJob(makeDeps({ toss, batchLog }));

    await job.run(NOW);

    expect(batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "success" }));
  });
});

describe("collect-fx-market-hours job — fx fetch failure (partial_success)", () => {
  it("marks partial_success, checks findLatestRate for carry-forward logging, and still upserts calendars", async () => {
    const toss = makeToss({ getExchangeRate: vi.fn().mockRejectedValue(new Error("fx api down")) });
    const fxRepo = makeFxRepo({ findLatestRate: vi.fn().mockResolvedValue(repoOk({ rateDate: "2026-07-06", rate: 1340 })) });
    const calendarRepo = makeCalendarRepo();
    const batchLog = makeBatchLog();
    const job = createCollectFxMarketHoursJob(makeDeps({ toss, fxRepo, calendarRepo, batchLog }));

    await job.run(NOW);

    expect(fxRepo.findLatestRate).toHaveBeenCalledWith("USD", "KRW");
    expect(calendarRepo.upsertDays).toHaveBeenCalled();
    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "partial_success", failedCount: 1 }),
    );
    const [, summary] = (batchLog.finish as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((summary as { errorLog: string }).errorLog).toMatch(/FX_FETCH_FAILED/);
  });
});

describe("collect-fx-market-hours job — one market calendar step fails (spec Edge: 해당 시장 스텝만 실패)", () => {
  it("upserts only the succeeding market and reports partial_success", async () => {
    const toss = makeToss({
      getMarketCalendar: vi.fn().mockImplementation((market: string) => {
        if (market === "KRX") return Promise.reject(new Error("kr calendar down"));
        return Promise.resolve([
          { market: "US", calendarDate: "2026-07-08", isTradingDay: true, openAt: new Date(), closeAt: new Date(), isEarlyClose: false },
        ]);
      }),
    });
    const calendarRepo = makeCalendarRepo();
    const batchLog = makeBatchLog();
    const job = createCollectFxMarketHoursJob(makeDeps({ toss, calendarRepo, batchLog }));

    await job.run(NOW);

    const upsertCalls = (calendarRepo.upsertDays as ReturnType<typeof vi.fn>).mock.calls;
    expect(upsertCalls).toHaveLength(1);
    expect((upsertCalls[0]![0] as Array<{ market: string }>).every((r) => r.market === "US")).toBe(true);
    expect(batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "partial_success" }));
  });
});

describe("collect-fx-market-hours job — all three steps fail", () => {
  it("reports failed with failedCount=3", async () => {
    const toss = makeToss({
      getExchangeRate: vi.fn().mockRejectedValue(new Error("fx down")),
      getMarketCalendar: vi.fn().mockRejectedValue(new Error("calendar down")),
    });
    const batchLog = makeBatchLog();
    const job = createCollectFxMarketHoursJob(makeDeps({ toss, batchLog }));

    await job.run(NOW);

    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed", failedCount: 3 }),
    );
  });
});

describe("collect-fx-market-hours job — TossAuthError short-circuits (E5)", () => {
  it("stops immediately on the first step's auth failure, calling calendar steps 0 times", async () => {
    const toss = makeToss({ getExchangeRate: vi.fn().mockRejectedValue(new TossAuthError("bad creds")) });
    const batchLog = makeBatchLog();
    const job = createCollectFxMarketHoursJob(makeDeps({ toss, batchLog }));

    await job.run(NOW);

    expect(toss.getMarketCalendar).not.toHaveBeenCalled();
    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
    const [, summary] = (batchLog.finish as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((summary as { errorLog: string }).errorLog).toMatch(/TOSS_AUTH_FAILED/);
  });

  it("short-circuits mid-run (fx succeeds, KR calendar raises auth error) without running US calendar, keeping the fx upsert", async () => {
    const toss = makeToss({
      getMarketCalendar: vi.fn().mockRejectedValue(new TossAuthError("token expired mid-run")),
    });
    const fxRepo = makeFxRepo();
    const batchLog = makeBatchLog();
    const job = createCollectFxMarketHoursJob(makeDeps({ toss, fxRepo, batchLog }));

    await job.run(NOW);

    expect(fxRepo.upsertRate).toHaveBeenCalled(); // fx step already succeeded before the auth failure
    expect(toss.getMarketCalendar).toHaveBeenCalledTimes(1); // stopped after KR, US not attempted
    expect(batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
  });
});

describe("collect-fx-market-hours job — DB upsert failure", () => {
  it("marks the fx step failed with DB_UPSERT_FAILED when upsertRate returns {ok:false}", async () => {
    const fxRepo = makeFxRepo({ upsertRate: vi.fn().mockResolvedValue(repoFail("db down")) });
    const batchLog = makeBatchLog();
    const job = createCollectFxMarketHoursJob(makeDeps({ fxRepo, batchLog }));

    await job.run(NOW);

    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "partial_success" }),
    );
    const [, summary] = (batchLog.finish as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((summary as { errorLog: string }).errorLog).toMatch(/DB_UPSERT_FAILED/);
  });
});

describe("collect-fx-market-hours job — unexpected exception safety net", () => {
  it("finishes as failed and does not propagate when a repository throws unexpectedly", async () => {
    const fxRepo = makeFxRepo({ upsertRate: vi.fn().mockRejectedValue(new Error("kaboom")) });
    const batchLog = makeBatchLog();
    const job = createCollectFxMarketHoursJob(makeDeps({ fxRepo, batchLog }));

    await expect(job.run(NOW)).resolves.toBeUndefined();
    expect(batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
  });
});

describe("collect-fx-market-hours job — passes normalized dates through unchanged", () => {
  it("forwards rateDate/calendarDate from the adapter's normalized model without recomputation", async () => {
    const toss = makeToss({
      getExchangeRate: vi.fn().mockResolvedValue({
        kind: "ok",
        rate: { baseCurrency: "USD", quoteCurrency: "KRW", rate: 1400, rateDate: "2099-01-01" },
      }),
    });
    const fxRepo = makeFxRepo();
    const job = createCollectFxMarketHoursJob(makeDeps({ toss, fxRepo }));

    await job.run(NOW);

    expect(fxRepo.upsertRate).toHaveBeenCalledWith(expect.objectContaining({ rateDate: "2099-01-01" }));
  });
});
