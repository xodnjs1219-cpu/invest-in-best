import { describe, expect, it, vi } from "vitest";
import { registerSchedules } from "./scheduler";
import { COLLECT_QUOTES_CRON } from "@iib/domain";

function makeDeps() {
  const jobLock = { tryAcquire: vi.fn().mockReturnValue(true), release: vi.fn() };
  const collectQuotesJob = { run: vi.fn().mockResolvedValue(undefined) };
  const cronSchedule = vi.fn();
  return {
    jobLock,
    collectQuotesJob,
    cronSchedule,
  };
}

describe("registerSchedules", () => {
  it("registers the collect-quotes handler under COLLECT_QUOTES_CRON", () => {
    const deps = makeDeps();
    registerSchedules(deps);
    expect(deps.cronSchedule).toHaveBeenCalledWith(COLLECT_QUOTES_CRON, expect.any(Function));
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
});
