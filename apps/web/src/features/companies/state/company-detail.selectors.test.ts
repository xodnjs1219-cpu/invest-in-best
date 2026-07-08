import { describe, expect, it } from "vitest";
import type { IsoDate } from "@iib/domain";
import {
  selectFinancialsYearRange,
  selectQuotesDateRange,
} from "@/features/companies/state/company-detail.selectors";

describe("selectQuotesDateRange", () => {
  it("'1Y' + today='2026-07-07' → 최근 1년 범위", () => {
    expect(selectQuotesDateRange("1Y", "2026-07-07" as IsoDate)).toEqual({
      from: "2025-07-07",
      to: "2026-07-07",
    });
  });

  it("'MAX' → from은 TIMESERIES_MIN_START_DATE(2015-01-01)", () => {
    expect(selectQuotesDateRange("MAX", "2026-07-07" as IsoDate)).toEqual({
      from: "2015-01-01",
      to: "2026-07-07",
    });
  });

  it("'3M' + today='2026-07-07' → 3개월 전부터", () => {
    const result = selectQuotesDateRange("3M", "2026-07-07" as IsoDate);
    expect(result.from).toBe("2026-04-07");
    expect(result.to).toBe("2026-07-07");
  });
});

describe("selectFinancialsYearRange", () => {
  it("'3Y' + currentYear=2026 → { fromYear: 2024, toYear: 2026 }", () => {
    expect(selectFinancialsYearRange("3Y", 2026)).toEqual({ fromYear: 2024, toYear: 2026 });
  });

  it("'ALL' + currentYear=2026 → { fromYear: 2015, toYear: 2026 }", () => {
    expect(selectFinancialsYearRange("ALL", 2026)).toEqual({ fromYear: 2015, toYear: 2026 });
  });

  it("'10Y' + currentYear=2020 → fromYear는 2015로 클램프(하한)", () => {
    expect(selectFinancialsYearRange("10Y", 2020)).toEqual({ fromYear: 2015, toYear: 2020 });
  });

  it("'5Y' + currentYear=2026 → { fromYear: 2022, toYear: 2026 }", () => {
    expect(selectFinancialsYearRange("5Y", 2026)).toEqual({ fromYear: 2022, toYear: 2026 });
  });
});
