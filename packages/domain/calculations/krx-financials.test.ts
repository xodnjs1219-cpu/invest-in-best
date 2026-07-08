import { describe, expect, it } from "vitest";
import { normalizeKrxQuarters, resolveDartTargetReports, resolveKrxPeriod } from "./krx-financials";

describe("normalizeKrxQuarters", () => {
  it("derives 2Q/4Q by cumulative subtraction and keeps 1Q/3Q as three-month values", () => {
    const rows = normalizeKrxQuarters({
      fiscalYear: 2025,
      metric: "revenue",
      q1: { threeMonth: 100, cumulative: 100 },
      half: { threeMonth: null, cumulative: 250 },
      q3: { threeMonth: 180, cumulative: 430 },
      annual: { threeMonth: null, cumulative: 600 },
    });

    const byQuarter = Object.fromEntries(rows.filter((r) => r.periodType === "quarter").map((r) => [r.fiscalQuarter, r]));
    expect(byQuarter[1]).toMatchObject({ amount: 100, amountBasis: "three_month" });
    expect(byQuarter[2]).toMatchObject({ amount: 150, amountBasis: "derived_from_cumulative" });
    expect(byQuarter[3]).toMatchObject({ amount: 180, amountBasis: "three_month" });
    expect(byQuarter[4]).toMatchObject({ amount: 170, amountBasis: "derived_from_cumulative" });
    const annualRow = rows.find((r) => r.periodType === "annual");
    expect(annualRow).toMatchObject({ amount: 600 });
  });

  it("falls back 2Q to half three-month value when 1Q is missing (OQ-3)", () => {
    const rows = normalizeKrxQuarters({
      fiscalYear: 2025,
      metric: "revenue",
      q1: { threeMonth: null, cumulative: null },
      half: { threeMonth: 140, cumulative: 140 },
      q3: null,
      annual: null,
    });
    const q2 = rows.find((r) => r.periodType === "quarter" && r.fiscalQuarter === 2);
    expect(q2).toMatchObject({ amount: 140, amountBasis: "three_month" });
  });

  it("omits Q4 when Q3 cumulative is missing, but still produces the other quarters (E4)", () => {
    const rows = normalizeKrxQuarters({
      fiscalYear: 2025,
      metric: "revenue",
      q1: { threeMonth: 100, cumulative: 100 },
      half: { threeMonth: null, cumulative: 250 },
      q3: { threeMonth: 180, cumulative: null },
      annual: { threeMonth: null, cumulative: 600 },
    });
    const q4 = rows.find((r) => r.periodType === "quarter" && r.fiscalQuarter === 4);
    expect(q4).toBeUndefined();
    expect(rows.some((r) => r.fiscalQuarter === 1)).toBe(true);
    expect(rows.some((r) => r.fiscalQuarter === 3)).toBe(true);
  });

  it("excludes fiscal_year=2014 input entirely (E2)", () => {
    const rows = normalizeKrxQuarters({
      fiscalYear: 2014,
      metric: "revenue",
      q1: { threeMonth: 100, cumulative: 100 },
      half: null,
      q3: null,
      annual: null,
    });
    expect(rows).toHaveLength(0);
  });

  it("preserves sign for negative operating income (operating loss)", () => {
    const rows = normalizeKrxQuarters({
      fiscalYear: 2025,
      metric: "operatingIncome",
      q1: { threeMonth: -50, cumulative: -50 },
      half: { threeMonth: null, cumulative: -120 },
      q3: null,
      annual: null,
    });
    const q2 = rows.find((r) => r.fiscalQuarter === 2);
    expect(q2?.amount).toBe(-70);
  });
});

describe("resolveDartTargetReports", () => {
  it("includes Q1(11013,2026) and prior annual report(11011,2025) around mid-May", () => {
    const reports = resolveDartTargetReports(new Date("2026-05-15T00:00:00Z"));
    expect(reports).toEqual(
      expect.arrayContaining([
        { bsnsYear: 2026, reprtCode: "11013" },
        { bsnsYear: 2025, reprtCode: "11011" },
      ]),
    );
  });

  it("resolves a sensible window for early February (annual report season boundary)", () => {
    const reports = resolveDartTargetReports(new Date("2026-02-01T00:00:00Z"));
    expect(reports.length).toBeGreaterThan(0);
    // Either the prior year's Q3 or annual report should be included around this boundary.
    expect(
      reports.some((r) => r.reprtCode === "11014" || r.reprtCode === "11011"),
    ).toBe(true);
  });
});

describe("resolveKrxPeriod", () => {
  it("resolves the half-year report's 3-month (Q2) window for a December fiscal year end", () => {
    expect(resolveKrxPeriod(2026, "11012")).toEqual({ start: "2026-04-01", end: "2026-06-30" });
  });

  it("resolves the Q1 report window", () => {
    expect(resolveKrxPeriod(2026, "11013")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
  });

  it("resolves the annual report window", () => {
    expect(resolveKrxPeriod(2026, "11011")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});
