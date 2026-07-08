import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findLatestBySource, upsertShares } from "./shares.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("upsertShares", () => {
  it("upserts with onConflict 'security_id,as_of_date,source'", async () => {
    const upsertedRows: unknown[] = [];
    const upsertOptions: unknown[] = [];
    const upsert = vi.fn((rows: unknown, options: unknown) => {
      upsertedRows.push(rows);
      upsertOptions.push(options);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertShares(client, [
      {
        securityId: "sec-1",
        shares: 100,
        asOfDate: "2025-12-31",
        source: "dart",
        sourceTag: "istc_totqy",
        isMultiClassPartial: false,
      },
    ]);

    expect(from).toHaveBeenCalledWith("shares_outstanding");
    expect(upsertOptions[0]).toMatchObject({ onConflict: "security_id,as_of_date,source" });
    const rows = upsertedRows[0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ security_id: "sec-1", shares: 100, source: "dart" });
    expect(result.ok).toBe(true);
  });

  it("is a no-op success for an empty list", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await upsertShares(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

describe("findLatestBySource", () => {
  it("filters by security ids and source, returning the latest as_of_date per security", async () => {
    const orderFn = vi.fn().mockResolvedValue({
      data: [
        { security_id: "sec-1", shares: 100, as_of_date: "2025-12-31" },
        { security_id: "sec-1", shares: 90, as_of_date: "2025-09-30" },
        { security_id: "sec-2", shares: 200, as_of_date: "2025-12-31" },
      ],
      error: null,
    });
    const eqSource = vi.fn().mockReturnValue({ order: orderFn });
    const inFn = vi.fn().mockReturnValue({ eq: eqSource });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findLatestBySource(client, ["sec-1", "sec-2"], "toss");

    expect(from).toHaveBeenCalledWith("shares_outstanding");
    expect(inFn).toHaveBeenCalledWith("security_id", ["sec-1", "sec-2"]);
    expect(eqSource).toHaveBeenCalledWith("source", "toss");
    expect(orderFn).toHaveBeenCalledWith("as_of_date", { ascending: false });
    // Only the latest row per security should remain (app-side reduction).
    expect(result).toEqual({
      ok: true,
      data: [
        { securityId: "sec-1", shares: 100, asOfDate: "2025-12-31" },
        { securityId: "sec-2", shares: 200, asOfDate: "2025-12-31" },
      ],
    });
  });
});
