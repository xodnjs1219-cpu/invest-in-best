import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBatchLogger } from "./batch-log";
import * as batchRepo from "../repositories/batch.repository";

describe("createBatchLogger", () => {
  it("start() calls insertRun and returns the runId", async () => {
    vi.spyOn(batchRepo, "insertRun").mockResolvedValue({
      ok: true,
      data: { runId: "run-1" },
    });
    const logger = createBatchLogger({} as SupabaseClient);

    const runId = await logger.start("collect_quotes");
    expect(runId).toBe("run-1");
  });

  it("finish() delegates to finishRun with the given summary", async () => {
    const finishSpy = vi.spyOn(batchRepo, "finishRun").mockResolvedValue({ ok: true, data: undefined });
    const logger = createBatchLogger({} as SupabaseClient);

    await logger.finish("run-1", {
      status: "success",
      processedCount: 5,
      failedCount: 0,
      isCarriedOver: false,
      errorLog: null,
    });

    expect(finishSpy).toHaveBeenCalledWith(
      {},
      "run-1",
      expect.objectContaining({ status: "success", processedCount: 5 }),
    );
  });

  it("swallows repository failures and only logs a warning (does not throw)", async () => {
    vi.spyOn(batchRepo, "insertRun").mockResolvedValue({ ok: false, error: "db down" });
    const warnSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createBatchLogger({} as SupabaseClient);

    const runId = await logger.start("collect_quotes");
    expect(runId).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("itemFailures() delegates to insertItemFailures", async () => {
    const spy = vi.spyOn(batchRepo, "insertItemFailures").mockResolvedValue({ ok: true, data: undefined });
    const logger = createBatchLogger({} as SupabaseClient);

    await logger.itemFailures("run-1", [{ securityId: "sec-1", attemptCount: 3, lastError: "x" }]);
    expect(spy).toHaveBeenCalledWith({}, "run-1", [
      { securityId: "sec-1", attemptCount: 3, lastError: "x" },
    ]);
  });

  it("resolve() delegates to resolveFailures", async () => {
    const spy = vi.spyOn(batchRepo, "resolveFailures").mockResolvedValue({ ok: true, data: undefined });
    const logger = createBatchLogger({} as SupabaseClient);

    await logger.resolve(["f-1"]);
    expect(spy).toHaveBeenCalledWith({}, ["f-1"]);
  });
});
