import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findExistingPeriodKeys, upsertFinancials } from "./financials.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("upsertFinancials", () => {
  it("chunks 2500 rows into 1000/1000/500 RPC calls and sums the affected counts", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 1000, error: null })
      .mockResolvedValueOnce({ data: 1000, error: null })
      .mockResolvedValueOnce({ data: 500, error: null });
    const client = makeClient({ rpc });

    const rows = Array.from({ length: 2500 }, (_, i) => ({ securityId: `sec-${i}`, fiscalYear: 2025 }));
    const result = await upsertFinancials(client, rows as never);

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledWith("fn_upsert_quarterly_financials", expect.objectContaining({ p_rows: expect.any(Array) }));
    expect(result).toEqual({ ok: true, data: { affected: 2500, failedChunks: 0 } });
  });

  it("reports a failed chunk without throwing (partial success aggregation)", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 1000, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "db error" } });
    const client = makeClient({ rpc });

    const rows = Array.from({ length: 1500 }, (_, i) => ({ securityId: `sec-${i}`, fiscalYear: 2025 }));
    const result = await upsertFinancials(client, rows as never);

    expect(result).toEqual({ ok: true, data: { affected: 1000, failedChunks: 1 } });
  });
});

describe("findExistingPeriodKeys", () => {
  it("filters by security ids, fiscal year, and fiscal quarter", async () => {
    const eqQuarter = vi.fn().mockResolvedValue({ data: [{ security_id: "sec-1" }], error: null });
    const eqYear = vi.fn().mockReturnValue({ eq: eqQuarter });
    const inFn = vi.fn().mockReturnValue({ eq: eqYear });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findExistingPeriodKeys(client, ["sec-1", "sec-2"], 2025, 1);

    expect(from).toHaveBeenCalledWith("quarterly_financials");
    expect(inFn).toHaveBeenCalledWith("security_id", ["sec-1", "sec-2"]);
    expect(eqYear).toHaveBeenCalledWith("fiscal_year", 2025);
    expect(eqQuarter).toHaveBeenCalledWith("fiscal_quarter", 1);
    expect(result).toEqual({ ok: true, data: new Set(["sec-1"]) });
  });
});
