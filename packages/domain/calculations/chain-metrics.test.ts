import { describe, expect, it } from "vitest";
import {
  calculateDailyChainMetric,
  calculateQuarterlyChainMetric,
  classifyQuarterlyConstituent,
  resolveEffectiveSnapshot,
} from "./chain-metrics";

describe("resolveEffectiveSnapshot", () => {
  it("selects the last snapshot at/before the boundary, including same-day changes (E4/C-6)", () => {
    const snapshots = [
      { id: "snap-1", effectiveAt: "2026-05-01T01:00:00.000Z" },
      { id: "snap-2", effectiveAt: "2026-05-02T00:30:00.000Z" },
    ];
    const boundary = "2026-05-02T14:59:59.000Z"; // 2026-05-02 23:59:59 KST in UTC
    expect(resolveEffectiveSnapshot(snapshots, boundary)).toEqual(snapshots[1]);
  });

  it("returns null when the boundary precedes the first snapshot (E7)", () => {
    const snapshots = [{ id: "snap-1", effectiveAt: "2026-05-01T01:00:00.000Z" }];
    expect(resolveEffectiveSnapshot(snapshots, "2026-04-30T14:59:59.000Z")).toBeNull();
  });
});

describe("calculateDailyChainMetric", () => {
  it("sums close*shares for two normal KRX constituents", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 2,
      listedNodes: [
        { securityId: "a", currency: "KRW" },
        { securityId: "b", currency: "KRW" },
      ],
      closeOf: (id) =>
        id === "a"
          ? { value: 1000, observedDate: "2026-07-06" as never, isCarried: false }
          : { value: 2000, observedDate: "2026-07-06" as never, isCarried: false },
      sharesOf: (id) => (id === "a" ? 10 : 5),
      fxRateAt: () => null,
    });
    expect(result).toEqual({
      totalMarketCapKrw: 1000 * 10 + 2000 * 5,
      coveredNodeCount: 2,
      totalNodeCount: 2,
      isCarriedForward: false,
    });
  });

  it("converts USD constituents using the fx rate when present", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 1,
      listedNodes: [{ securityId: "usd-1", currency: "USD" }],
      closeOf: () => ({ value: 100, observedDate: "2026-07-06" as never, isCarried: false }),
      sharesOf: () => 10,
      fxRateAt: () => ({ value: 1300, observedDate: "2026-07-06" as never, isCarried: false }),
    });
    expect(result.totalMarketCapKrw).toBe(100 * 10 * 1300);
    expect(result.isCarriedForward).toBe(false);
  });

  it("marks isCarriedForward when the fx rate is carried (E2)", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 1,
      listedNodes: [{ securityId: "usd-1", currency: "USD" }],
      closeOf: () => ({ value: 100, observedDate: "2026-07-06" as never, isCarried: false }),
      sharesOf: () => 10,
      fxRateAt: () => ({ value: 1300, observedDate: "2026-07-05" as never, isCarried: true }),
    });
    expect(result.isCarriedForward).toBe(true);
  });

  it("excludes a USD constituent with no fx observation at all (H-9) while keeping KRX constituents", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 2,
      listedNodes: [
        { securityId: "krx-1", currency: "KRW" },
        { securityId: "usd-1", currency: "USD" },
      ],
      closeOf: () => ({ value: 1000, observedDate: "2026-07-06" as never, isCarried: false }),
      sharesOf: () => 10,
      fxRateAt: () => null,
    });
    expect(result.totalMarketCapKrw).toBe(1000 * 10);
    expect(result.coveredNodeCount).toBe(1);
    expect(result.totalNodeCount).toBe(2);
  });

  it("marks isCarriedForward when a close price is carried through a holiday (E2)", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 1,
      listedNodes: [{ securityId: "a", currency: "KRW" }],
      closeOf: () => ({ value: 1000, observedDate: "2026-07-03" as never, isCarried: true }),
      sharesOf: () => 10,
      fxRateAt: () => null,
    });
    expect(result.isCarriedForward).toBe(true);
    expect(result.coveredNodeCount).toBe(1);
  });

  it("excludes a constituent with no close observation before the first observation (E3)", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 1,
      listedNodes: [{ securityId: "a", currency: "KRW" }],
      closeOf: () => null,
      sharesOf: () => 10,
      fxRateAt: () => null,
    });
    expect(result.coveredNodeCount).toBe(0);
    expect(result.totalNodeCount).toBe(1);
    expect(result.totalMarketCapKrw).toBeNull();
  });

  it("excludes a constituent with no shares outstanding", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 1,
      listedNodes: [{ securityId: "a", currency: "KRW" }],
      closeOf: () => ({ value: 1000, observedDate: "2026-07-06" as never, isCarried: false }),
      sharesOf: () => null,
      fxRateAt: () => null,
    });
    expect(result.coveredNodeCount).toBe(0);
    expect(result.totalMarketCapKrw).toBeNull();
  });

  it("reports null (not 0) when there are zero listed-company nodes (E1)", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 3,
      listedNodes: [],
      closeOf: () => null,
      sharesOf: () => null,
      fxRateAt: () => null,
    });
    expect(result).toEqual({
      totalMarketCapKrw: null,
      coveredNodeCount: 0,
      totalNodeCount: 3,
      isCarriedForward: false,
    });
  });

  it("records an exact zero sum as 0, not null (theoretical edge case)", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 1,
      listedNodes: [{ securityId: "a", currency: "KRW" }],
      closeOf: () => ({ value: 0, observedDate: "2026-07-06" as never, isCarried: false }),
      sharesOf: () => 10,
      fxRateAt: () => null,
    });
    expect(result.totalMarketCapKrw).toBe(0);
    expect(result.coveredNodeCount).toBe(1);
  });

  it("rounds the summed amount to 2 decimal places (numeric(28,2) alignment)", () => {
    const result = calculateDailyChainMetric({
      totalNodeCount: 1,
      listedNodes: [{ securityId: "a", currency: "USD" }],
      closeOf: () => ({ value: 10.001, observedDate: "2026-07-06" as never, isCarried: false }),
      sharesOf: () => 3,
      fxRateAt: () => ({ value: 1300.333, observedDate: "2026-07-06" as never, isCarried: false }),
    });
    const raw = 10.001 * 3 * 1300.333;
    expect(result.totalMarketCapKrw).toBe(Math.round(raw * 100) / 100);
  });
});

describe("classifyQuarterlyConstituent", () => {
  it("classifies included when revenue is present in KRW", () => {
    expect(
      classifyQuarterlyConstituent({
        quarterRow: { revenue: 1000, currency: "KRW", isRevenueTagUnmapped: false },
        hasAnnualOnly: false,
        fxRate: null,
      }),
    ).toBe("included");
  });

  it("classifies excluded_unmapped for tag-unmapped rows (E8)", () => {
    expect(
      classifyQuarterlyConstituent({
        quarterRow: { revenue: 1000, currency: "USD", isRevenueTagUnmapped: true },
        hasAnnualOnly: false,
        fxRate: 1300,
      }),
    ).toBe("excluded_unmapped");
  });

  it("classifies excluded_annual_only when no quarter row exists but an annual-only row does (E8, 20-F)", () => {
    expect(
      classifyQuarterlyConstituent({
        quarterRow: null,
        hasAnnualOnly: true,
        fxRate: null,
      }),
    ).toBe("excluded_annual_only");
  });

  it("classifies excluded_no_fx for a USD row with no fx observation (H-9)", () => {
    expect(
      classifyQuarterlyConstituent({
        quarterRow: { revenue: 1000, currency: "USD", isRevenueTagUnmapped: false },
        hasAnnualOnly: false,
        fxRate: null,
      }),
    ).toBe("excluded_no_fx");
  });

  it("classifies missing when there is no row at all (not collected)", () => {
    expect(
      classifyQuarterlyConstituent({
        quarterRow: null,
        hasAnnualOnly: false,
        fxRate: null,
      }),
    ).toBe("missing");
  });
});

describe("calculateQuarterlyChainMetric", () => {
  it("sums included constituents (KRW + USD) converted at the quarter-end fx rate", () => {
    const result = calculateQuarterlyChainMetric(
      [
        { securityId: "a", classification: "included", revenue: 1000, currency: "KRW", fxRate: null },
        { securityId: "b", classification: "included", revenue: 100, currency: "USD", fxRate: 1300 },
      ],
      2,
    );
    expect(result.totalRevenueKrw).toBe(1000 + 100 * 1300);
    expect(result.coveredNodeCount).toBe(2);
    expect(result.totalNodeCount).toBe(2);
  });

  it("excludes a tag-unmapped constituent and counts it in excludedUnmappedCount (E8)", () => {
    const result = calculateQuarterlyChainMetric(
      [
        { securityId: "a", classification: "included", revenue: 1000, currency: "KRW", fxRate: null },
        { securityId: "b", classification: "excluded_unmapped", revenue: null, currency: "USD", fxRate: null },
      ],
      2,
    );
    expect(result.excludedUnmappedCount).toBe(1);
    expect(result.coveredNodeCount).toBe(1);
  });

  it("excludes an annual-only constituent and counts it in excludedUnmappedCount (E8)", () => {
    const result = calculateQuarterlyChainMetric(
      [{ securityId: "a", classification: "excluded_annual_only", revenue: null, currency: "USD", fxRate: null }],
      1,
    );
    expect(result.excludedUnmappedCount).toBe(1);
    expect(result.totalRevenueKrw).toBeNull();
  });

  it("excludes a missing row without counting it toward n or excludedUnmappedCount", () => {
    const result = calculateQuarterlyChainMetric(
      [{ securityId: "a", classification: "missing", revenue: null, currency: "KRW", fxRate: null }],
      1,
    );
    expect(result.coveredNodeCount).toBe(0);
    expect(result.excludedUnmappedCount).toBe(0);
    expect(result.totalRevenueKrw).toBeNull();
  });

  it("reports null when zero constituents are included (C-8 — data not yet available)", () => {
    const result = calculateQuarterlyChainMetric([], 0);
    expect(result.totalRevenueKrw).toBeNull();
  });

  it("rounds the summed amount to 2 decimal places", () => {
    const result = calculateQuarterlyChainMetric(
      [{ securityId: "a", classification: "included", revenue: 100.005, currency: "USD", fxRate: 1300.001 }],
      1,
    );
    const raw = 100.005 * 1300.001;
    expect(result.totalRevenueKrw).toBe(Math.round(raw * 100) / 100);
  });
});
