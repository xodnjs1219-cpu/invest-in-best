import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findLatestRunByStatus,
  findRunningRun,
  findUnresolvedFailures,
  finishRun,
  insertItemFailures,
  insertRun,
  resolveFailures,
} from "./batch.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("insertRun", () => {
  it("inserts job_type/status='running' and returns the run id", async () => {
    const insertedRows: unknown[] = [];
    const single = vi.fn().mockResolvedValue({ data: { id: "run-1" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn((row: unknown) => {
      insertedRows.push(row);
      return { select };
    });
    const from = vi.fn().mockReturnValue({ insert });
    const client = makeClient({ from });

    const result = await insertRun(client, { jobType: "collect_quotes" });

    expect(from).toHaveBeenCalledWith("batch_runs");
    expect(insertedRows[0]).toMatchObject({ job_type: "collect_quotes", status: "running" });
    expect(result).toEqual({ ok: true, data: { runId: "run-1" } });
  });

  it("returns {ok:false} on DB error without throwing", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const client = makeClient({ from });

    const result = await insertRun(client, { jobType: "collect_quotes" });
    expect(result.ok).toBe(false);
  });
});

describe("finishRun", () => {
  it("updates status/counts/carried-over/error log and finished_at", async () => {
    const updatedRows: unknown[] = [];
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn((row: unknown) => {
      updatedRows.push(row);
      return { eq };
    });
    const from = vi.fn().mockReturnValue({ update });
    const client = makeClient({ from });

    const result = await finishRun(client, "run-1", {
      status: "success",
      processedCount: 10,
      failedCount: 0,
      isCarriedOver: false,
      errorLog: null,
    });

    expect(from).toHaveBeenCalledWith("batch_runs");
    expect(updatedRows[0]).toMatchObject({
      status: "success",
      processed_count: 10,
      failed_count: 0,
      is_carried_over: false,
      error_log: null,
    });
    expect(updatedRows[0]).toHaveProperty("finished_at");
    expect(eq).toHaveBeenCalledWith("id", "run-1");
    expect(result.ok).toBe(true);
  });
});

describe("findUnresolvedFailures", () => {
  it("applies job_type join and is_resolved=false filter", async () => {
    const eqIsResolved = vi.fn().mockResolvedValue({
      data: [{ id: "f-1", security_id: "sec-1" }],
      error: null,
    });
    const eqJobType = vi.fn().mockReturnValue({ eq: eqIsResolved });
    const select = vi.fn().mockReturnValue({ eq: eqJobType });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findUnresolvedFailures(client, "collect_quotes");

    expect(from).toHaveBeenCalledWith("batch_item_failures");
    expect(select.mock.calls[0]?.[0]).toContain("batch_runs!inner");
    expect(eqJobType).toHaveBeenCalledWith("batch_runs.job_type", "collect_quotes");
    expect(eqIsResolved).toHaveBeenCalledWith("is_resolved", false);
    expect(result).toEqual({
      ok: true,
      data: [{ id: "f-1", securityId: "sec-1" }],
    });
  });
});

describe("insertItemFailures", () => {
  it("converts camelCase input into snake_case rows", async () => {
    const insertedRows: unknown[] = [];
    const insert = vi.fn((rows: unknown) => {
      insertedRows.push(rows);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ insert });
    const client = makeClient({ from });

    const result = await insertItemFailures(client, "run-1", [
      { securityId: "sec-1", attemptCount: 3, lastError: "timeout" },
    ]);

    expect(from).toHaveBeenCalledWith("batch_item_failures");
    expect(insertedRows[0]).toEqual([
      {
        batch_run_id: "run-1",
        security_id: "sec-1",
        attempt_count: 3,
        last_error: "timeout",
      },
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("findRunningRun", () => {
  it("filters by job_type and status='running', ordered by started_at desc, limited to 1", async () => {
    const limitFn = vi.fn().mockResolvedValue({
      data: [{ id: "run-1", started_at: "2026-07-08T10:00:00Z" }],
      error: null,
    });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqStatus = vi.fn().mockReturnValue({ order: orderFn });
    const eqJobType = vi.fn().mockReturnValue({ eq: eqStatus });
    const select = vi.fn().mockReturnValue({ eq: eqJobType });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findRunningRun(client, "collect_financials");

    expect(from).toHaveBeenCalledWith("batch_runs");
    expect(eqJobType).toHaveBeenCalledWith("job_type", "collect_financials");
    expect(eqStatus).toHaveBeenCalledWith("status", "running");
    expect(orderFn).toHaveBeenCalledWith("started_at", { ascending: false });
    expect(limitFn).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      ok: true,
      data: { id: "run-1", startedAt: "2026-07-08T10:00:00Z" },
    });
  });

  it("returns null data when no running row exists", async () => {
    const limitFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqStatus = vi.fn().mockReturnValue({ order: orderFn });
    const eqJobType = vi.fn().mockReturnValue({ eq: eqStatus });
    const select = vi.fn().mockReturnValue({ eq: eqJobType });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findRunningRun(client, "collect_financials");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("findLatestRunByStatus", () => {
  it("filters by job_type and the given status, ordered by started_at desc, limited to 1", async () => {
    const limitFn = vi.fn().mockResolvedValue({
      data: [{ id: "run-9", started_at: "2026-07-05T23:00:00Z" }],
      error: null,
    });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqStatus = vi.fn().mockReturnValue({ order: orderFn });
    const eqJobType = vi.fn().mockReturnValue({ eq: eqStatus });
    const select = vi.fn().mockReturnValue({ eq: eqJobType });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findLatestRunByStatus(client, "aggregate_daily_metrics", "success");

    expect(from).toHaveBeenCalledWith("batch_runs");
    expect(eqJobType).toHaveBeenCalledWith("job_type", "aggregate_daily_metrics");
    expect(eqStatus).toHaveBeenCalledWith("status", "success");
    expect(orderFn).toHaveBeenCalledWith("started_at", { ascending: false });
    expect(limitFn).toHaveBeenCalledWith(1);
    expect(result).toEqual({ ok: true, data: { id: "run-9", startedAt: "2026-07-05T23:00:00Z" } });
  });

  it("returns null when no matching run exists (first run — full catch-up)", async () => {
    const limitFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqStatus = vi.fn().mockReturnValue({ order: orderFn });
    const eqJobType = vi.fn().mockReturnValue({ eq: eqStatus });
    const select = vi.fn().mockReturnValue({ eq: eqJobType });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findLatestRunByStatus(client, "aggregate_daily_metrics", "success");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("resolveFailures", () => {
  it("updates is_resolved=true for the given ids", async () => {
    const inFn = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ update });
    const client = makeClient({ from });

    const result = await resolveFailures(client, ["f-1", "f-2"]);

    expect(update).toHaveBeenCalledWith({ is_resolved: true });
    expect(inFn).toHaveBeenCalledWith("id", ["f-1", "f-2"]);
    expect(result.ok).toBe(true);
  });

  it("is a no-op success when the id list is empty", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await resolveFailures(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});
