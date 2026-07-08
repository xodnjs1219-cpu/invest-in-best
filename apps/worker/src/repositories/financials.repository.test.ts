import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IsoDate } from "@iib/domain";
import {
  findAnnualOnlySecurities,
  findExistingPeriodKeys,
  findMinCorrectedQuarterSince,
  findQuarterRevenues,
  upsertFinancials,
} from "./financials.repository";

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

describe("findQuarterRevenues", () => {
  it("filters by the calendar axis (calendar_year/calendar_quarter) and period_type='quarter' (BR 6.1)", async () => {
    const eqQuarter = vi.fn().mockResolvedValue({
      data: [{ security_id: "sec-1", revenue: 1000, currency: "KRW", is_revenue_tag_unmapped: false }],
      error: null,
    });
    const eqYear = vi.fn().mockReturnValue({ eq: eqQuarter });
    const eqPeriodType = vi.fn().mockReturnValue({ eq: eqYear });
    const inFn = vi.fn().mockReturnValue({ eq: eqPeriodType });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findQuarterRevenues(client, ["sec-1"], 2026, 2);

    expect(from).toHaveBeenCalledWith("quarterly_financials");
    expect(eqPeriodType).toHaveBeenCalledWith("period_type", "quarter");
    expect(eqYear).toHaveBeenCalledWith("calendar_year", 2026);
    expect(eqQuarter).toHaveBeenCalledWith("calendar_quarter", 2);
    expect(result).toEqual({
      ok: true,
      data: [{ securityId: "sec-1", revenue: 1000, currency: "KRW", isRevenueTagUnmapped: false }],
    });
  });

  it("returns an empty array without calling the DB when securityIds is empty", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await findQuarterRevenues(client, [], 2026, 2);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe("findAnnualOnlySecurities", () => {
  it("combines the period-overlap condition with the fiscal_year fallback for missing periods", async () => {
    const orFn = vi.fn().mockResolvedValue({ data: [{ security_id: "sec-1" }], error: null });
    const eqPeriodType = vi.fn().mockReturnValue({ or: orFn });
    const inFn = vi.fn().mockReturnValue({ eq: eqPeriodType });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findAnnualOnlySecurities(
      client,
      ["sec-1"],
      2026,
      "2026-04-01" as IsoDate,
      "2026-06-30" as IsoDate,
    );

    expect(eqPeriodType).toHaveBeenCalledWith("period_type", "annual");
    expect(orFn.mock.calls[0]?.[0]).toContain("fiscal_year.eq.2026");
    expect(orFn.mock.calls[0]?.[0]).toContain("period_start_date.lte.2026-06-30");
    expect(result).toEqual({ ok: true, data: new Set(["sec-1"]) });
  });
});

describe("findMinCorrectedQuarterSince", () => {
  it("queries updated_at > sinceIso for period_type='quarter' ordered by (year,quarter) asc limit 1", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { calendar_year: 2025, calendar_quarter: 3 }, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderQuarter = vi.fn().mockReturnValue({ limit: limitFn });
    const orderYear = vi.fn().mockReturnValue({ order: orderQuarter });
    const gt = vi.fn().mockReturnValue({ order: orderYear });
    const eqPeriodType = vi.fn().mockReturnValue({ gt });
    const select = vi.fn().mockReturnValue({ eq: eqPeriodType });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findMinCorrectedQuarterSince(client, "2026-07-01T00:00:00Z");

    expect(eqPeriodType).toHaveBeenCalledWith("period_type", "quarter");
    expect(gt).toHaveBeenCalledWith("updated_at", "2026-07-01T00:00:00Z");
    expect(result).toEqual({ ok: true, data: { year: 2025, quarter: 3 } });
  });

  it("returns null when no correction row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderQuarter = vi.fn().mockReturnValue({ limit: limitFn });
    const orderYear = vi.fn().mockReturnValue({ order: orderQuarter });
    const gt = vi.fn().mockReturnValue({ order: orderYear });
    const eqPeriodType = vi.fn().mockReturnValue({ gt });
    const select = vi.fn().mockReturnValue({ eq: eqPeriodType });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findMinCorrectedQuarterSince(client, "2026-07-01T00:00:00Z");
    expect(result).toEqual({ ok: true, data: null });
  });
});
