import { describe, expect, it, vi } from "vitest";
import { createRegularJobGuard } from "./regular-job-guard";
import { repoOk } from "../../repositories/result";

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

describe("createRegularJobGuard — waitUntilIdle (H-7)", () => {
  it("checks every conflict job type and returns immediately when none are running (no polling)", async () => {
    const { clock } = makeClock();
    const findRunningRun = vi.fn().mockResolvedValue(repoOk(null));
    const onWait = vi.fn();
    const guard = createRegularJobGuard({
      batchRepo: { findRunningRun },
      clock,
      onWait,
    });

    await guard.waitUntilIdle("run-1");

    expect(findRunningRun).toHaveBeenCalledWith("collect_quotes");
    expect(findRunningRun).toHaveBeenCalledWith("collect_financials");
    expect(findRunningRun).toHaveBeenCalledWith("collect_fx_market_hours");
    expect(findRunningRun).toHaveBeenCalledWith("aggregate_daily_metrics");
    expect(findRunningRun).toHaveBeenCalledWith("analyze_disclosures");
    // backfill_all itself must never be checked against (it is not a conflict target).
    expect(findRunningRun).not.toHaveBeenCalledWith("backfill_all");
    expect(onWait).not.toHaveBeenCalled();
  });

  it("polls until the conflicting job (e.g. collect_quotes) finishes, then returns", async () => {
    const { clock, sleeps } = makeClock();
    let callCount = 0;
    const findRunningRun = vi.fn().mockImplementation((jobType: string) => {
      if (jobType !== "collect_quotes") return Promise.resolve(repoOk(null));
      callCount += 1;
      return Promise.resolve(callCount < 3 ? repoOk({ id: "r-1", startedAt: "t" }) : repoOk(null));
    });
    const onWait = vi.fn();
    const guard = createRegularJobGuard({
      batchRepo: { findRunningRun },
      clock,
      onWait,
    });

    await guard.waitUntilIdle("run-1");

    expect(sleeps.length).toBeGreaterThanOrEqual(2);
    expect(onWait).toHaveBeenCalled();
  });

  it("invokes onWait (heartbeat) with the runId on each polling cycle to avoid a false orphan verdict", async () => {
    const { clock } = makeClock();
    let calls = 0;
    const findRunningRun = vi.fn().mockImplementation((jobType: string) => {
      if (jobType !== "aggregate_daily_metrics") return Promise.resolve(repoOk(null));
      calls += 1;
      return Promise.resolve(calls < 2 ? repoOk({ id: "r-2", startedAt: "t" }) : repoOk(null));
    });
    const onWait = vi.fn();
    const guard = createRegularJobGuard({
      batchRepo: { findRunningRun },
      clock,
      onWait,
    });

    await guard.waitUntilIdle("run-1");
    expect(onWait).toHaveBeenCalledWith("run-1");
  });
});
