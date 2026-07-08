import { describe, expect, it } from "vitest";
import {
  buildUsQuarterRows,
  isAnnualOnlyFiler,
  pickRevenueFacts,
  pickSharesOutstanding,
  type UsdFact,
} from "./us-financials";
import { US_REVENUE_TAG_CHAIN, SEC_SHARES_TAG_CHAIN } from "../constants/financials";

function fact(overrides: Partial<UsdFact> & { end: string; start?: string; val: number }): UsdFact {
  return {
    start: overrides.start ?? "2025-01-01",
    end: overrides.end,
    val: overrides.val,
    fy: overrides.fy ?? 2025,
    fp: overrides.fp ?? "Q1",
    form: overrides.form ?? "10-Q",
    filed: overrides.filed ?? "2025-05-01",
    accn: overrides.accn ?? "0000000000-25-000001",
  };
}

describe("pickRevenueFacts", () => {
  it("stitches tag chain facts across the transition period and dedupes by (fy,start,end)", () => {
    const facts = {
      "us-gaap:SalesRevenueNet": [
        fact({ start: "2017-01-01", end: "2017-03-31", val: 100, fy: 2017 }),
      ],
      "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax": [
        fact({ start: "2019-01-01", end: "2019-03-31", val: 200, fy: 2019 }),
      ],
    };
    const result = pickRevenueFacts(facts, US_REVENUE_TAG_CHAIN);
    expect(result.unmapped).toBe(false);
    expect(result.facts).toHaveLength(2);
    expect(result.sourceTag).toBe("us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax");
  });

  it("keeps the latest filed value when the same (fy,start,end) appears twice (restated)", () => {
    const facts = {
      "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax": [
        fact({ start: "2024-09-29", end: "2024-12-28", val: 100, fy: 2025, filed: "2025-02-01", accn: "A" }),
        fact({ start: "2024-09-29", end: "2024-12-28", val: 105, fy: 2026, filed: "2026-02-01", accn: "B" }),
      ],
    };
    const result = pickRevenueFacts(facts, US_REVENUE_TAG_CHAIN);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]?.val).toBe(105);
  });

  it("separates stub periods (invalid length) into stubPeriods without dropping valid ones", () => {
    const facts = {
      "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax": [
        fact({ start: "2025-01-01", end: "2025-03-31", val: 100 }), // normal ~90d
        fact({ start: "2025-02-08", end: "2025-03-31", val: 20 }), // ~51d stub
      ],
    };
    const result = pickRevenueFacts(facts, US_REVENUE_TAG_CHAIN);
    expect(result.facts).toHaveLength(1);
    expect(result.stubPeriods).toHaveLength(1);
  });

  it("returns unmapped:true when no tag in the chain has any facts (E3)", () => {
    const result = pickRevenueFacts({}, US_REVENUE_TAG_CHAIN);
    expect(result.unmapped).toBe(true);
    expect(result.facts).toHaveLength(0);
  });
});

describe("buildUsQuarterRows", () => {
  it("derives Q4 = FY - Q1 - Q2 - Q3 with calendar axis from end dates", () => {
    const revenueFacts = [
      fact({ start: "2025-01-01", end: "2025-03-31", val: 100, fy: 2025, fp: "Q1" }),
      fact({ start: "2025-04-01", end: "2025-06-30", val: 150, fy: 2025, fp: "Q2" }),
      fact({ start: "2025-07-01", end: "2025-09-30", val: 180, fy: 2025, fp: "Q3" }),
      fact({ start: "2025-01-01", end: "2025-12-31", val: 600, fy: 2025, fp: "FY" }),
    ];
    const result = buildUsQuarterRows(revenueFacts);
    const q4 = result.rows.find((r) => r.fiscalYear === 2025 && r.fiscalQuarter === 4);
    expect(q4).toMatchObject({ amount: 170, amountBasis: "derived_from_cumulative" });
    const annual = result.rows.find((r) => r.periodType === "annual" && r.fiscalYear === 2025);
    expect(annual).toMatchObject({ amount: 600 });
  });

  it("skips Q4 derivation when a stub period breaks contiguity (E14)", () => {
    const revenueFacts = [
      fact({ start: "2025-01-01", end: "2025-03-31", val: 100, fy: 2025, fp: "Q1" }),
      fact({ start: "2025-04-01", end: "2025-05-21", val: 30, fy: 2025, fp: "Q2" }), // ~51d stub, non-contiguous with Q3
      fact({ start: "2025-07-01", end: "2025-09-30", val: 180, fy: 2025, fp: "Q3" }),
      fact({ start: "2025-01-01", end: "2025-12-31", val: 600, fy: 2025, fp: "FY" }),
    ];
    const result = buildUsQuarterRows(revenueFacts);
    const q4 = result.rows.find((r) => r.fiscalYear === 2025 && r.fiscalQuarter === 4);
    expect(q4).toBeUndefined();
  });

  it("produces only an annual row for a 20-F filer with no quarterly facts (E13, Alibaba-style)", () => {
    const revenueFacts = [fact({ start: "2025-01-01", end: "2025-12-31", val: 600, fy: 2025, fp: "FY" })];
    const result = buildUsQuarterRows(revenueFacts);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ periodType: "annual", amount: 600 });
  });
});

describe("pickSharesOutstanding", () => {
  it("selects the dei tag when present and non-partial", () => {
    const facts = {
      "dei:EntityCommonStockSharesOutstanding": [
        fact({ start: "2026-04-17", end: "2026-04-17", val: 14_687_356_000 }),
      ],
    };
    const result = pickSharesOutstanding(facts, SEC_SHARES_TAG_CHAIN);
    expect(result).toMatchObject({
      shares: 14_687_356_000,
      sourceTag: "dei:EntityCommonStockSharesOutstanding",
      isPartial: false,
    });
  });

  it("falls back to us-gaap:CommonStockSharesOutstanding with isPartial=true (Alphabet-style)", () => {
    const facts = {
      "us-gaap:CommonStockSharesOutstanding": [fact({ start: "2025-12-31", end: "2025-12-31", val: 12_088_000_000 })],
    };
    const result = pickSharesOutstanding(facts, SEC_SHARES_TAG_CHAIN);
    expect(result).toMatchObject({ shares: 12_088_000_000, isPartial: true });
  });

  it("skips a val:0 fact and evaluates the next tag (Berkshire-style)", () => {
    const facts = {
      "dei:EntityCommonStockSharesOutstanding": [fact({ start: "2011-01-01", end: "2011-01-01", val: 0 })],
      "us-gaap:WeightedAverageNumberOfSharesOutstandingBasic": [
        fact({ start: "2025-01-01", end: "2025-12-31", val: 1_500_000 }),
      ],
    };
    const result = pickSharesOutstanding(facts, SEC_SHARES_TAG_CHAIN);
    expect(result).toMatchObject({ shares: 1_500_000, isPartial: true });
  });

  it("returns null when all fallback stages fail (E12, Meta-style)", () => {
    const result = pickSharesOutstanding({}, SEC_SHARES_TAG_CHAIN);
    expect(result).toBeNull();
  });
});

describe("isAnnualOnlyFiler", () => {
  it("returns true when only 20-F/40-F forms exist (no 10-Q)", () => {
    expect(isAnnualOnlyFiler(["20-F", "6-K", "20-F"])).toBe(true);
  });

  it("returns false when a 10-Q is present", () => {
    expect(isAnnualOnlyFiler(["10-K", "10-Q"])).toBe(false);
  });
});
