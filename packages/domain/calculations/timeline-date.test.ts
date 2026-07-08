import { describe, expect, it } from "vitest";
import { isValidIsoDate, todayInSeoul, toSeoulDayEndIso, isWithinTimelineRange } from "./timeline-date";
import type { IsoDate } from "../types/common";

describe("isValidIsoDate", () => {
  it("유효한 YYYY-MM-DD → true", () => {
    expect(isValidIsoDate("2026-05-02")).toBe(true);
  });

  it("형식 오류(구분자 없음/한 자리) → false", () => {
    expect(isValidIsoDate("2026-5-2")).toBe(false);
    expect(isValidIsoDate("20260502")).toBe(false);
  });

  it("실존하지 않는 날짜(2월 30일) → false", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
  });

  it("빈 문자열 → false", () => {
    expect(isValidIsoDate("")).toBe(false);
  });
});

describe("todayInSeoul", () => {
  it("UTC 자정 이후에도 Asia/Seoul 기준으로 넘어간 날짜를 반환한다", () => {
    const utc = new Date("2026-07-05T16:00:00Z"); // KST 07-06 01:00
    expect(todayInSeoul(utc)).toBe("2026-07-06");
  });
});

describe("toSeoulDayEndIso", () => {
  it("당일 23:59:59 Asia/Seoul을 UTC로 변환한다", () => {
    const result = toSeoulDayEndIso("2026-05-02" as IsoDate);
    expect(result).toBe(new Date("2026-05-02T14:59:59.000Z").toISOString());
  });

  it("연말 경계에서도 올바르게 변환한다", () => {
    const result = toSeoulDayEndIso("2026-12-31" as IsoDate);
    expect(result).toBe(new Date("2026-12-31T14:59:59.000Z").toISOString());
  });
});

describe("isWithinTimelineRange", () => {
  it("하한 당일은 포함(true)", () => {
    expect(isWithinTimelineRange("2015-01-01" as IsoDate, "2026-07-06" as IsoDate)).toBe(true);
  });

  it("하한 전날은 제외(false)", () => {
    expect(isWithinTimelineRange("2014-12-31" as IsoDate, "2026-07-06" as IsoDate)).toBe(false);
  });

  it("오늘은 포함, 내일은 제외", () => {
    expect(isWithinTimelineRange("2026-07-06" as IsoDate, "2026-07-06" as IsoDate)).toBe(true);
    expect(isWithinTimelineRange("2026-07-07" as IsoDate, "2026-07-06" as IsoDate)).toBe(false);
  });
});
