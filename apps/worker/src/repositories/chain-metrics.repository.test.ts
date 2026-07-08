import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertDailyMetrics, upsertQuarterlyMetrics } from "./chain-metrics.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

function makeDailyRow(chainId: string, metricDate: string) {
  return {
    chainId,
    metricDate,
    basedOnSnapshotId: "snap-1",
    totalMarketCapKrw: 1000,
    coveredNodeCount: 1,
    totalNodeCount: 1,
    isCarriedForward: false,
  };
}

describe("upsertDailyMetrics", () => {
  it("splits 2500 rows into 1000/1000/500 chunks with the correct onConflict key", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const rows = Array.from({ length: 2500 }, (_, i) => makeDailyRow("chain-1", `2026-01-${(i % 28) + 1}`));
    const result = await upsertDailyMetrics(client, rows);

    expect(from).toHaveBeenCalledWith("chain_daily_metrics");
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert.mock.calls[0]?.[1]).toEqual({ onConflict: "chain_id,metric_date" });
    expect(result).toEqual({ ok: true, data: { count: 2500 } });
  });

  it("passes through total_market_cap_krw: null without converting to 0 (E1)", async () => {
    const upsertedRows: unknown[] = [];
    const upsert = vi.fn((rows: unknown) => {
      upsertedRows.push(rows);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    await upsertDailyMetrics(client, [
      { ...makeDailyRow("chain-1", "2026-01-01"), totalMarketCapKrw: null, coveredNodeCount: 0 },
    ]);

    expect((upsertedRows[0] as Array<{ total_market_cap_krw: unknown }>)[0]?.total_market_cap_krw).toBeNull();
  });

  it("classifies a foreign-key violation (23503) as chain_deleted (E15)", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { code: "23503", message: "fk violation" } });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertDailyMetrics(client, [makeDailyRow("chain-1", "2026-01-01")]);
    expect(result).toEqual({ ok: false, kind: "chain_deleted", message: "fk violation" });
  });

  it("retries once on a generic DB error then reports db_error", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: "500", message: "transient" } })
      .mockResolvedValueOnce({ error: { code: "500", message: "transient" } });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertDailyMetrics(client, [makeDailyRow("chain-1", "2026-01-01")]);
    expect(upsert).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    expect(result).toEqual({ ok: false, kind: "db_error", message: "transient" });
  });

  it("returns count:0 without calling the DB for an empty array", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await upsertDailyMetrics(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: { count: 0 } });
  });
});

describe("upsertQuarterlyMetrics", () => {
  it("uses the (chain_id,calendar_year,calendar_quarter) onConflict key", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertQuarterlyMetrics(client, [
      {
        chainId: "chain-1",
        calendarYear: 2026,
        calendarQuarter: 2,
        basedOnSnapshotId: "snap-1",
        totalRevenueKrw: 5000,
        coveredNodeCount: 2,
        totalNodeCount: 2,
        excludedUnmappedCount: 0,
      },
    ]);

    expect(from).toHaveBeenCalledWith("chain_quarterly_metrics");
    expect(upsert.mock.calls[0]?.[1]).toEqual({ onConflict: "chain_id,calendar_year,calendar_quarter" });
    expect(result).toEqual({ ok: true, data: { count: 1 } });
  });
});
