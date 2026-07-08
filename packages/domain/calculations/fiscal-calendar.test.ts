import { describe, expect, it } from "vitest";
import { arePeriodsContiguous, resolveCalendarPeriod, validatePeriodLength } from "./fiscal-calendar";

describe("resolveCalendarPeriod", () => {
  it("maps Apple's fiscal 1Q (9/28~12/27) to calendar 2025 Q4 (midpoint rule)", () => {
    expect(resolveCalendarPeriod("2025-09-28", "2025-12-27")).toEqual({
      calendarYear: 2025,
      calendarQuarter: 4,
    });
  });

  it("keeps a plain calendar-aligned quarter unchanged", () => {
    expect(resolveCalendarPeriod("2026-01-01", "2026-03-31")).toEqual({
      calendarYear: 2026,
      calendarQuarter: 1,
    });
  });

  it("resolves calendarYear only (quarter meaningless) for a 12-month annual period", () => {
    const result = resolveCalendarPeriod("2025-01-01", "2025-12-31", "annual");
    expect(result.calendarYear).toBe(2025);
  });
});

describe("validatePeriodLength", () => {
  it("rejects a 51-day stub quarter (Bally's-style M&A stub period)", () => {
    expect(validatePeriodLength("2025-02-08", "2025-03-31", "quarter")).toBe(false);
  });

  it("accepts a normal ~91-day quarter", () => {
    expect(validatePeriodLength("2025-01-01", "2025-03-31", "quarter")).toBe(true);
  });

  it("rejects a 300-day period claiming to be annual", () => {
    expect(validatePeriodLength("2025-01-01", "2025-10-28", "annual")).toBe(false);
  });

  it("accepts a normal ~365-day annual period", () => {
    expect(validatePeriodLength("2025-01-01", "2025-12-31", "annual")).toBe(true);
  });
});

describe("arePeriodsContiguous", () => {
  it("returns false when periods overlap by one day", () => {
    const periods = [
      { start: "2025-01-01", end: "2025-03-31" },
      { start: "2025-03-31", end: "2025-06-30" },
      { start: "2025-07-01", end: "2025-09-30" },
    ];
    expect(arePeriodsContiguous(periods)).toBe(false);
  });

  it("returns true for normally contiguous quarters", () => {
    const periods = [
      { start: "2025-01-01", end: "2025-03-31" },
      { start: "2025-04-01", end: "2025-06-30" },
      { start: "2025-07-01", end: "2025-09-30" },
    ];
    expect(arePeriodsContiguous(periods)).toBe(true);
  });

  it("returns false when there is a gap between periods (stub period broke the sequence)", () => {
    const periods = [
      { start: "2025-01-01", end: "2025-03-31" },
      { start: "2025-04-01", end: "2025-05-21" }, // stub, ends early
      { start: "2025-07-01", end: "2025-09-30" }, // gap: 05-22~06-30 missing
    ];
    expect(arePeriodsContiguous(periods)).toBe(false);
  });
});
