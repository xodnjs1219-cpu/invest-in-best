import { describe, expect, it, vi } from "vitest";
import { registerSchedules } from "./scheduler";
import {
  BATCH_CRON_TIMEZONE,
  BATCH_TIMEZONE,
  COLLECT_FINANCIALS_CRON,
  COLLECT_FX_MARKET_HOURS_CRON,
  COLLECT_QUOTES_CRON,
} from "@iib/domain";

function makeDeps() {
  const jobLock = { tryAcquire: vi.fn().mockReturnValue(true), release: vi.fn() };
  const collectQuotesJob = { run: vi.fn().mockResolvedValue(undefined) };
  const collectFinancialsJob = { run: vi.fn().mockResolvedValue(undefined) };
  const collectFxMarketHoursJob = { run: vi.fn().mockResolvedValue(undefined) };
  const cronSchedule = vi.fn();
  return {
    jobLock,
    collectQuotesJob,
    collectFinancialsJob,
    collectFxMarketHoursJob,
    cronSchedule,
  };
}

describe("registerSchedules", () => {
  it("registers the collect-quotes handler under COLLECT_QUOTES_CRON", () => {
    const deps = makeDeps();
    registerSchedules(deps);
    expect(deps.cronSchedule).toHaveBeenCalledWith(COLLECT_QUOTES_CRON, expect.any(Function), undefined);
  });

  it("does not invoke the job when lock acquisition fails", async () => {
    const deps = makeDeps();
    deps.jobLock.tryAcquire.mockReturnValue(false);
    registerSchedules(deps);

    const handler = deps.cronSchedule.mock.calls[0]?.[1] as () => Promise<void>;
    await handler();

    expect(deps.collectQuotesJob.run).not.toHaveBeenCalled();
  });

  it("exits cleanly and releases the lock even if the job throws", async () => {
    const deps = makeDeps();
    deps.collectQuotesJob.run.mockRejectedValue(new Error("boom"));
    registerSchedules(deps);

    const handler = deps.cronSchedule.mock.calls[0]?.[1] as () => Promise<void>;
    await expect(handler()).resolves.toBeUndefined();

    expect(deps.jobLock.release).toHaveBeenCalledWith("collect_quotes");
  });

  it("registers the collect-financials handler under COLLECT_FINANCIALS_CRON with the KST timezone (UC-027)", () => {
    const deps = makeDeps();
    registerSchedules(deps);
    expect(deps.cronSchedule).toHaveBeenCalledWith(
      COLLECT_FINANCIALS_CRON,
      expect.any(Function),
      { timezone: BATCH_TIMEZONE },
    );
  });

  it("collect-financials registration coexists with collect-quotes (no regression)", () => {
    const deps = makeDeps();
    registerSchedules(deps);
    expect(deps.cronSchedule).toHaveBeenCalledWith(COLLECT_FINANCIALS_CRON, expect.any(Function), expect.anything());
    expect(deps.cronSchedule).toHaveBeenCalledWith(COLLECT_QUOTES_CRON, expect.any(Function), undefined);
  });

  it("collect-financials handler skips when the lock is held, and releases the lock on job exception", async () => {
    const deps = makeDeps();
    deps.collectFinancialsJob.run.mockRejectedValue(new Error("boom"));
    registerSchedules(deps);

    const financialsCall = deps.cronSchedule.mock.calls.find(([expr]) => expr === COLLECT_FINANCIALS_CRON);
    const handler = financialsCall?.[1] as () => Promise<void>;
    await expect(handler()).resolves.toBeUndefined();

    expect(deps.jobLock.release).toHaveBeenCalledWith("collect_financials");
  });

  it("registers the collect-fx-market-hours handler under COLLECT_FX_MARKET_HOURS_CRON with the KST timezone (UC-028)", () => {
    const deps = makeDeps();
    registerSchedules(deps);
    expect(deps.cronSchedule).toHaveBeenCalledWith(
      COLLECT_FX_MARKET_HOURS_CRON,
      expect.any(Function),
      { timezone: BATCH_CRON_TIMEZONE },
    );
  });

  it("collect-fx-market-hours registration coexists with collect-quotes and collect-financials (no regression)", () => {
    const deps = makeDeps();
    registerSchedules(deps);
    expect(deps.cronSchedule).toHaveBeenCalledTimes(3);
  });

  it("collect-fx-market-hours handler skips when the lock is held, and releases the lock on job exception", async () => {
    const deps = makeDeps();
    deps.collectFxMarketHoursJob.run.mockRejectedValue(new Error("boom"));
    registerSchedules(deps);

    const fxCall = deps.cronSchedule.mock.calls.find(([expr]) => expr === COLLECT_FX_MARKET_HOURS_CRON);
    const handler = fxCall?.[1] as () => Promise<void>;
    await expect(handler()).resolves.toBeUndefined();

    expect(deps.jobLock.release).toHaveBeenCalledWith("collect_fx_market_hours");
  });

  it("does not invoke collect-fx-market-hours when its lock is already held", async () => {
    const deps = makeDeps();
    deps.jobLock.tryAcquire.mockImplementation((jobType: string) => jobType !== "collect_fx_market_hours");
    registerSchedules(deps);

    const fxCall = deps.cronSchedule.mock.calls.find(([expr]) => expr === COLLECT_FX_MARKET_HOURS_CRON);
    const handler = fxCall?.[1] as () => Promise<void>;
    await handler();

    expect(deps.collectFxMarketHoursJob.run).not.toHaveBeenCalled();
  });
});
