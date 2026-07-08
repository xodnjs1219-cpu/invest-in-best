import { describe, expect, it } from "vitest";
import {
  enumerateDates,
  quarterEndDate,
  quarterStartDate,
  resolveDailyTargetRange,
  resolveTargetQuarters,
  splitRangeByWindow,
} from "./aggregation-range";
import type { IsoDate } from "../types/common";

const d = (s: string) => s as IsoDate;

describe("resolveDailyTargetRange", () => {
  it("resolves [prevSuccess-day+1, today-1] when a previous success exists (catch-up window)", () => {
    // KST 2026-07-06 08:00 == UTC 2026-07-05 23:00
    const result = resolveDailyTargetRange({
      prevSuccessStartedAt: "2026-07-05T23:00:00.000Z",
      correctionMinDates: [],
      today: d("2026-07-07"),
    });
    expect(result).toEqual({ from: d("2026-07-06"), to: d("2026-07-06") });
  });

  it("starts from the timeseries floor when there is no previous success (first run / post-backfill)", () => {
    const result = resolveDailyTargetRange({
      prevSuccessStartedAt: null,
      correctionMinDates: [],
      today: d("2026-07-07"),
    });
    expect(result?.from).toBe("2015-01-01");
  });

  it("extends from to the correction minimum date when it precedes baseFrom (E6)", () => {
    const result = resolveDailyTargetRange({
      prevSuccessStartedAt: "2026-07-05T23:00:00.000Z", // baseFrom = 2026-07-06
      correctionMinDates: [d("2026-06-20")],
      today: d("2026-07-07"),
    });
    expect(result).toEqual({ from: d("2026-06-20"), to: d("2026-07-06") });
  });

  it("clamps a correction date before the timeseries floor to 2015-01-01 (E16)", () => {
    const result = resolveDailyTargetRange({
      prevSuccessStartedAt: "2026-07-05T23:00:00.000Z",
      correctionMinDates: [d("2014-01-01")],
      today: d("2026-07-07"),
    });
    expect(result?.from).toBe("2015-01-01");
  });

  it("returns null for a same-day rerun (baseFrom == today)", () => {
    // prevSuccess started today at KST 07:00 -> baseFrom = tomorrow's date > to(today-1)
    const result = resolveDailyTargetRange({
      prevSuccessStartedAt: "2026-07-06T22:00:00.000Z", // KST 2026-07-07 07:00
      correctionMinDates: [],
      today: d("2026-07-07"),
    });
    expect(result).toBeNull();
  });

  it("catches up multiple days after a multi-day gap (E10)", () => {
    // prevSuccess started KST 2026-07-03 09:00 -> baseFrom = 2026-07-03 (that run covered through 07-02)
    const result = resolveDailyTargetRange({
      prevSuccessStartedAt: "2026-07-03T00:00:00.000Z",
      correctionMinDates: [],
      today: d("2026-07-07"),
    });
    expect(result).toEqual({ from: d("2026-07-03"), to: d("2026-07-06") });
  });
});

describe("resolveTargetQuarters", () => {
  it("lists a continuous run from the financial correction quarter through today's quarter", () => {
    const result = resolveTargetQuarters({
      correctionMinQuarter: { year: 2025, quarter: 3 },
      fxCorrectionMinDate: null,
      hasPrevSuccess: true,
      to: d("2026-07-06"),
    });
    expect(result).toEqual([
      { year: 2025, quarter: 3 },
      { year: 2025, quarter: 4 },
      { year: 2026, quarter: 1 },
      { year: 2026, quarter: 2 },
      { year: 2026, quarter: 3 },
    ]);
  });

  it("returns an empty list when there is no correction/new data and a previous success exists", () => {
    const result = resolveTargetQuarters({
      correctionMinQuarter: null,
      fxCorrectionMinDate: null,
      hasPrevSuccess: true,
      to: d("2026-07-06"),
    });
    expect(result).toEqual([]);
  });

  it("reflects the fx correction minimum date's quarter as the start", () => {
    const result = resolveTargetQuarters({
      correctionMinQuarter: null,
      fxCorrectionMinDate: d("2026-01-15"),
      hasPrevSuccess: true,
      to: d("2026-07-06"),
    });
    expect(result[0]).toEqual({ year: 2026, quarter: 1 });
  });

  it("starts from 2015Q1 when there is no previous success (first run)", () => {
    const result = resolveTargetQuarters({
      correctionMinQuarter: null,
      fxCorrectionMinDate: null,
      hasPrevSuccess: false,
      to: d("2015-04-01"),
    });
    expect(result[0]).toEqual({ year: 2015, quarter: 1 });
  });
});

describe("splitRangeByWindow", () => {
  it("splits into contiguous, non-overlapping windows with no gaps at boundaries", () => {
    const windows = splitRangeByWindow(d("2015-01-01"), d("2026-07-06"), 370);
    // no gaps: each window's from == previous window's to + 1 day
    for (let i = 1; i < windows.length; i += 1) {
      const prevTo = new Date(`${windows[i - 1]!.to}T00:00:00Z`);
      const curFrom = new Date(`${windows[i]!.from}T00:00:00Z`);
      const diffDays = (curFrom.getTime() - prevTo.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBe(1);
    }
    expect(windows[0]!.from).toBe("2015-01-01");
    expect(windows[windows.length - 1]!.to).toBe("2026-07-06");
  });
});

describe("quarterEndDate / quarterStartDate", () => {
  it("computes quarter end dates including the leap-year February boundary", () => {
    expect(quarterEndDate(2026, 1)).toBe("2026-03-31");
    expect(quarterEndDate(2026, 4)).toBe("2026-12-31");
  });

  it("computes quarter start dates", () => {
    expect(quarterStartDate(2026, 1)).toBe("2026-01-01");
    expect(quarterStartDate(2026, 4)).toBe("2026-10-01");
  });
});

describe("enumerateDates", () => {
  it("enumerates all dates in ascending order inclusive of both ends", () => {
    expect(enumerateDates(d("2026-01-01"), d("2026-01-03"))).toEqual([
      d("2026-01-01"),
      d("2026-01-02"),
      d("2026-01-03"),
    ]);
  });
});
