import { describe, expect, it, vi } from "vitest";
import { createBackfillAllJob, type BackfillAllJobDeps } from "./backfill-all.job";
import { repoOk } from "../repositories/result";

function makeBatchRepo(overrides: Record<string, unknown> = {}) {
  return {
    findRunningRun: vi.fn().mockResolvedValue(repoOk(null)),
    insertRun: vi.fn().mockResolvedValue(repoOk({ runId: "run-1" })),
    finishRun: vi.fn().mockResolvedValue(repoOk(undefined)),
    markRunOrphaned: vi.fn().mockResolvedValue(repoOk(undefined)),
    updateRunProgress: vi.fn().mockResolvedValue(repoOk(undefined)),
    ...overrides,
  };
}

function makeCheckpointsRepo(overrides: Record<string, unknown> = {}) {
  return {
    findIncompleteCheckpoints: vi.fn().mockResolvedValue(repoOk([])),
    deleteAllCheckpoints: vi.fn().mockResolvedValue(repoOk(undefined)),
    get: vi.fn().mockResolvedValue(repoOk(null)),
    upsert: vi.fn().mockResolvedValue(repoOk(undefined)),
    complete: vi.fn().mockResolvedValue(repoOk(undefined)),
    ...overrides,
  };
}

function makeSecuritiesRepo(overrides: Record<string, unknown> = {}) {
  return {
    findAllForFinancials: vi.fn().mockResolvedValue(repoOk([])),
    ...overrides,
  };
}

function makePhase0(overrides: Record<string, unknown> = {}) {
  return { run: vi.fn().mockResolvedValue({ processed: 0, skipped: false }), ...overrides };
}
function makePhase1(overrides: Record<string, unknown> = {}) {
  return { run: vi.fn().mockResolvedValue({ processed: 0, failed: 0, carriedOver: false, authFailed: false }), ...overrides };
}
function makePhase2(overrides: Record<string, unknown> = {}) {
  return { run: vi.fn().mockResolvedValue({ processed: 0, failed: 0, carriedOver: false }), ...overrides };
}
function makePhase3(overrides: Record<string, unknown> = {}) {
  return { run: vi.fn().mockResolvedValue({ processed: 0, failed: 0, carriedOver: false }), ...overrides };
}

function makeDeps(overrides: Partial<BackfillAllJobDeps> = {}): BackfillAllJobDeps {
  return {
    batchRepo: makeBatchRepo(),
    checkpointsRepo: makeCheckpointsRepo(),
    securitiesRepo: makeSecuritiesRepo(),
    guard: { waitUntilIdle: vi.fn().mockResolvedValue(undefined) },
    phase0: makePhase0(),
    phase1: makePhase1(),
    phase2: makePhase2(),
    phase3: makePhase3(),
    ...overrides,
  };
}

describe("backfill-all.job — startup checks", () => {
  it("skips startup (no batch_runs insert) when a fresh backfill_all run is already running", async () => {
    const batchRepo = makeBatchRepo({
      findRunningRun: vi.fn().mockImplementation((jobType: string) =>
        jobType === "backfill_all"
          ? Promise.resolve(repoOk({ id: "r-0", startedAt: new Date().toISOString() }))
          : Promise.resolve(repoOk(null)),
      ),
    });
    const job = createBackfillAllJob(makeDeps({ batchRepo }));

    await job.run();

    expect(batchRepo.insertRun).not.toHaveBeenCalled();
  });

  it("treats a stale running row (heartbeat older than threshold) as an orphan and proceeds (E17)", async () => {
    const staleStartedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 min ago > 10 min stale threshold
    const batchRepo = makeBatchRepo({
      findRunningRun: vi.fn().mockImplementation((jobType: string) =>
        jobType === "backfill_all"
          ? Promise.resolve(repoOk({ id: "r-0", startedAt: staleStartedAt }))
          : Promise.resolve(repoOk(null)),
      ),
    });
    const job = createBackfillAllJob(makeDeps({ batchRepo }));

    await job.run();

    expect(batchRepo.markRunOrphaned).toHaveBeenCalledWith("r-0");
    expect(batchRepo.insertRun).toHaveBeenCalled();
  });

  it("waits for conflicting regular jobs before starting (H-7)", async () => {
    const guard = { waitUntilIdle: vi.fn().mockResolvedValue(undefined) };
    const job = createBackfillAllJob(makeDeps({ guard }));

    await job.run();

    expect(guard.waitUntilIdle).toHaveBeenCalled();
  });
});

describe("backfill-all.job — reset (H-8)", () => {
  it("deletes all backfill_all checkpoints when reset:true is passed", async () => {
    const checkpointsRepo = makeCheckpointsRepo();
    const job = createBackfillAllJob(makeDeps({ checkpointsRepo }));

    await job.run({ reset: true });

    expect(checkpointsRepo.deleteAllCheckpoints).toHaveBeenCalledWith("backfill_all");
  });

  it("does not reset by default", async () => {
    const checkpointsRepo = makeCheckpointsRepo();
    const job = createBackfillAllJob(makeDeps({ checkpointsRepo }));

    await job.run();

    expect(checkpointsRepo.deleteAllCheckpoints).not.toHaveBeenCalled();
  });
});

describe("backfill-all.job — phase orchestration & completion", () => {
  it("runs Phase 0 through Phase 3 in order for a fresh run", async () => {
    const callOrder: string[] = [];
    const phase0 = makePhase0({ run: vi.fn().mockImplementation(async () => { callOrder.push("phase0"); return { processed: 1, skipped: false }; }) });
    const phase1 = makePhase1({ run: vi.fn().mockImplementation(async () => { callOrder.push("phase1"); return { processed: 1, failed: 0, carriedOver: false, authFailed: false }; }) });
    const phase2 = makePhase2({ run: vi.fn().mockImplementation(async () => { callOrder.push("phase2"); return { processed: 1, failed: 0, carriedOver: false }; }) });
    const phase3 = makePhase3({ run: vi.fn().mockImplementation(async () => { callOrder.push("phase3"); return { processed: 1, failed: 0, carriedOver: false }; }) });

    const job = createBackfillAllJob(makeDeps({ phase0, phase1, phase2, phase3 }));
    await job.run();

    expect(callOrder).toEqual(["phase0", "phase1", "phase2", "phase3"]);
  });

  it("finishes with status=success and invokes the follow-up aggregation hook once when all phases succeed with 0 failures (BR-10)", async () => {
    const batchRepo = makeBatchRepo();
    const runFollowUpAggregation = vi.fn().mockResolvedValue(undefined);
    const job = createBackfillAllJob(makeDeps({ batchRepo, runFollowUpAggregation }));

    await job.run();

    expect(batchRepo.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "success" }),
    );
    expect(runFollowUpAggregation).toHaveBeenCalledTimes(1);
  });

  it("logs but does not throw when the follow-up hook is not injected (pre-UC-029 no-op)", async () => {
    const job = createBackfillAllJob(makeDeps());
    await expect(job.run()).resolves.toBeUndefined();
  });

  it("finishes with status=partial_success and is_carried_over=true when a phase reports carriedOver (E3)", async () => {
    const batchRepo = makeBatchRepo();
    const phase2 = makePhase2({ run: vi.fn().mockResolvedValue({ processed: 0, failed: 0, carriedOver: true }) });
    const job = createBackfillAllJob(makeDeps({ batchRepo, phase2 }));

    await job.run();

    expect(batchRepo.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "partial_success", isCarriedOver: true }),
    );
  });

  it("finishes with status=partial_success (no carry-over) when a phase reports failed>0 without carryOver", async () => {
    const batchRepo = makeBatchRepo();
    const phase1 = makePhase1({ run: vi.fn().mockResolvedValue({ processed: 0, failed: 2, carriedOver: false, authFailed: false }) });
    const job = createBackfillAllJob(makeDeps({ batchRepo, phase1 }));

    await job.run();

    expect(batchRepo.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "partial_success", failedCount: 2 }),
    );
  });

  it("finishes with status=failed when Phase 1 reports authFailed (all-source credential failure escalates)", async () => {
    const batchRepo = makeBatchRepo();
    const phase1 = makePhase1({ run: vi.fn().mockResolvedValue({ processed: 0, failed: 0, carriedOver: false, authFailed: true }) });
    const job = createBackfillAllJob(makeDeps({ batchRepo, phase1 }));

    await job.run();

    expect(batchRepo.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("still records finish(failed) and does not propagate when an unexpected exception occurs", async () => {
    const batchRepo = makeBatchRepo();
    const phase0 = makePhase0({ run: vi.fn().mockRejectedValue(new Error("boom")) });
    const job = createBackfillAllJob(makeDeps({ batchRepo, phase0 }));

    await expect(job.run()).resolves.toBeUndefined();
    expect(batchRepo.finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
  });
});
