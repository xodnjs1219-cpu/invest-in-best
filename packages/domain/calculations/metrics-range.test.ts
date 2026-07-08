import { describe, expect, it } from "vitest";
import {
  presetToDailyRange,
  resolveDailyMetricsRange,
  dateToCalendarQuarter,
  quarterOrdinal,
  resolveQuarterlyMetricsRange,
} from "./metrics-range";
import type { IsoDate } from "../types/common";

const TODAY = "2026-07-06" as IsoDate;

describe("presetToDailyRange", () => {
  it("1Y → 오늘로부터 1년 전", () => {
    expect(presetToDailyRange("1Y", TODAY)).toEqual({ from: "2025-07-06", to: TODAY });
  });

  it("MAX → 시계열 최소 시작 시점으로 클램프", () => {
    expect(presetToDailyRange("MAX", TODAY)).toEqual({ from: "2015-01-01", to: TODAY });
  });

  it("1M/3M/6M/3Y 각각 올바른 개월/연 차감", () => {
    expect(presetToDailyRange("1M", TODAY).from).toBe("2026-06-06");
    expect(presetToDailyRange("3M", TODAY).from).toBe("2026-04-06");
    expect(presetToDailyRange("6M", TODAY).from).toBe("2026-01-06");
    expect(presetToDailyRange("3Y", TODAY).from).toBe("2023-07-06");
  });
});

describe("resolveDailyMetricsRange", () => {
  it("파라미터 전부 미지정 → 기본 1Y 범위(C-5)", () => {
    const result = resolveDailyMetricsRange({ today: TODAY });
    expect(result).toEqual({ ok: true, from: "2025-07-06", to: TODAY, at: null });
  });

  it("from이 하한 이전 → 2015-01-01로 클램프(E8)", () => {
    const result = resolveDailyMetricsRange({ from: "2010-01-01", today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.from).toBe("2015-01-01");
  });

  it("to가 미래 → 오늘로 보정(E11)", () => {
    const result = resolveDailyMetricsRange({ to: "2030-01-01", today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.to).toBe(TODAY);
  });

  it("보정 후 from > to → FROM_AFTER_TO", () => {
    const result = resolveDailyMetricsRange({ from: "2026-07-01", to: "2026-06-01", today: TODAY });
    expect(result).toEqual({ ok: false, reason: "FROM_AFTER_TO" });
  });

  it("at이 미래 → AT_OUT_OF_RANGE", () => {
    const result = resolveDailyMetricsRange({ at: "2030-01-01", today: TODAY });
    expect(result).toEqual({ ok: false, reason: "AT_OUT_OF_RANGE" });
  });

  it("at이 2015 이전 → AT_OUT_OF_RANGE", () => {
    const result = resolveDailyMetricsRange({ at: "2014-12-31", today: TODAY });
    expect(result).toEqual({ ok: false, reason: "AT_OUT_OF_RANGE" });
  });

  it("at 지정 → 그대로 반환", () => {
    const result = resolveDailyMetricsRange({ at: "2026-05-02", today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.at).toBe("2026-05-02");
  });
});

describe("dateToCalendarQuarter", () => {
  it("1~3월 → Q1", () => {
    expect(dateToCalendarQuarter("2026-01-01" as IsoDate)).toEqual({ calendarYear: 2026, calendarQuarter: 1 });
    expect(dateToCalendarQuarter("2026-03-31" as IsoDate)).toEqual({ calendarYear: 2026, calendarQuarter: 1 });
  });

  it("4월 → Q2 경계", () => {
    expect(dateToCalendarQuarter("2026-04-01" as IsoDate)).toEqual({ calendarYear: 2026, calendarQuarter: 2 });
  });

  it("12월 → Q4", () => {
    expect(dateToCalendarQuarter("2026-12-31" as IsoDate)).toEqual({ calendarYear: 2026, calendarQuarter: 4 });
  });
});

describe("quarterOrdinal", () => {
  it("연/분기를 단조 증가 정수로 변환한다", () => {
    expect(quarterOrdinal(2025, 4)).toBeLessThan(quarterOrdinal(2026, 1));
    expect(quarterOrdinal(2026, 1)).toBeLessThan(quarterOrdinal(2026, 2));
  });
});

describe("resolveQuarterlyMetricsRange", () => {
  it("기본값 → 오늘 분기 포함 최근 범위, 하한 2015Q1 클램프", () => {
    const result = resolveQuarterlyMetricsRange({ today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.to).toEqual({ year: 2026, quarter: 3 });
    }
  });

  it("fromYear만 있고 fromQuarter 누락 → INVALID_PAIR", () => {
    const result = resolveQuarterlyMetricsRange({ fromYear: 2025, today: TODAY });
    expect(result).toEqual({ ok: false, reason: "INVALID_PAIR" });
  });

  it("fromOrdinal > toOrdinal → FROM_AFTER_TO", () => {
    const result = resolveQuarterlyMetricsRange({
      fromYear: 2026,
      fromQuarter: 3,
      toYear: 2026,
      toQuarter: 1,
      today: TODAY,
    });
    expect(result).toEqual({ ok: false, reason: "FROM_AFTER_TO" });
  });

  it("fromYear=2010 → 2015Q1로 클램프(E8)", () => {
    const result = resolveQuarterlyMetricsRange({
      fromYear: 2010,
      fromQuarter: 1,
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.from).toEqual({ year: 2015, quarter: 1 });
  });

  it("toYear가 미래 분기 → 오늘 분기로 보정", () => {
    const result = resolveQuarterlyMetricsRange({
      toYear: 2030,
      toQuarter: 1,
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.to).toEqual({ year: 2026, quarter: 3 });
  });

  it("at 지정 시 atQuarter 산출", () => {
    const result = resolveQuarterlyMetricsRange({ at: "2026-05-02", today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.atQuarter).toEqual({ calendarYear: 2026, calendarQuarter: 2 });
  });

  it("at 미지정 시 atQuarter는 null", () => {
    const result = resolveQuarterlyMetricsRange({ today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.atQuarter).toBeNull();
  });
});
