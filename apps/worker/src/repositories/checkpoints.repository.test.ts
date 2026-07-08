import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeCheckpoint, getCheckpoint, upsertCheckpoint } from "./checkpoints.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("getCheckpoint", () => {
  it("filters by job_type and checkpoint_key and returns cursor/isCompleted", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { cursor: { page: 3 }, is_completed: false },
      error: null,
    });
    const eqKey = vi.fn().mockReturnValue({ maybeSingle });
    const eqJobType = vi.fn().mockReturnValue({ eq: eqKey });
    const select = vi.fn().mockReturnValue({ eq: eqJobType });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await getCheckpoint(client, "collect_financials", "dart:carryover");

    expect(from).toHaveBeenCalledWith("batch_checkpoints");
    expect(eqJobType).toHaveBeenCalledWith("job_type", "collect_financials");
    expect(eqKey).toHaveBeenCalledWith("checkpoint_key", "dart:carryover");
    expect(result).toEqual({ ok: true, data: { cursor: { page: 3 }, isCompleted: false } });
  });

  it("returns null data when no checkpoint row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqKey = vi.fn().mockReturnValue({ maybeSingle });
    const eqJobType = vi.fn().mockReturnValue({ eq: eqKey });
    const select = vi.fn().mockReturnValue({ eq: eqJobType });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await getCheckpoint(client, "collect_financials", "dart:carryover");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("upsertCheckpoint", () => {
  it("upserts with onConflict job_type,checkpoint_key", async () => {
    const upsertedRows: unknown[] = [];
    const upsertOptions: unknown[] = [];
    const upsert = vi.fn((row: unknown, options: unknown) => {
      upsertedRows.push(row);
      upsertOptions.push(options);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertCheckpoint(client, "collect_financials", "dart:carryover", { page: 4 }, false);

    expect(from).toHaveBeenCalledWith("batch_checkpoints");
    expect(upsertedRows[0]).toMatchObject({
      job_type: "collect_financials",
      checkpoint_key: "dart:carryover",
      cursor: { page: 4 },
      is_completed: false,
    });
    expect(upsertOptions[0]).toMatchObject({ onConflict: "job_type,checkpoint_key" });
    expect(result.ok).toBe(true);
  });
});

describe("completeCheckpoint", () => {
  it("updates is_completed=true for the given job_type/checkpoint_key", async () => {
    const eqKey = vi.fn().mockResolvedValue({ error: null });
    const eqJobType = vi.fn().mockReturnValue({ eq: eqKey });
    const update = vi.fn().mockReturnValue({ eq: eqJobType });
    const from = vi.fn().mockReturnValue({ update });
    const client = makeClient({ from });

    const result = await completeCheckpoint(client, "collect_financials", "dart:carryover");

    expect(update).toHaveBeenCalledWith({ is_completed: true });
    expect(eqJobType).toHaveBeenCalledWith("job_type", "collect_financials");
    expect(eqKey).toHaveBeenCalledWith("checkpoint_key", "dart:carryover");
    expect(result.ok).toBe(true);
  });
});
