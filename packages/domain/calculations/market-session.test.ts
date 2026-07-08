import { describe, expect, it } from "vitest";
import {
  localDayUtcRange,
  normalizeToHourUtc,
  resolveLocalDate,
  resolveMarketPhase,
} from "./market-session";

describe("resolveLocalDate", () => {
  it("returns the previous local day for US when it is early morning KST", () => {
    // 2026-07-06T03:00Z == 2026-07-05 23:00 in New York (EDT, UTC-4)
    expect(resolveLocalDate("US", new Date("2026-07-06T03:00:00Z"))).toBe("2026-07-05");
  });

  it("returns the KRX local date (KST)", () => {
    // 2026-07-05T16:30Z == 2026-07-06 01:30 KST
    expect(resolveLocalDate("KRX", new Date("2026-07-05T16:30:00Z"))).toBe("2026-07-06");
  });
});

describe("resolveMarketPhase", () => {
  const openAt = new Date("2026-07-06T00:00:00Z"); // 09:00 KST
  const closeAt = new Date("2026-07-06T06:30:00Z"); // 15:30 KST
  const calendar = { isTradingDay: true, openAt, closeAt };

  it("returns 'unknown' when there is no calendar row (E9)", () => {
    expect(resolveMarketPhase(null, new Date("2026-07-06T01:00:00Z"))).toBe("unknown");
  });

  it("returns 'holiday' when isTradingDay=false", () => {
    expect(
      resolveMarketPhase(
        { isTradingDay: false, openAt: null, closeAt: null },
        new Date("2026-07-06T01:00:00Z"),
      ),
    ).toBe("holiday");
  });

  it("returns 'holiday' when openAt/closeAt are null even if isTradingDay=true", () => {
    expect(
      resolveMarketPhase(
        { isTradingDay: true, openAt: null, closeAt: null },
        new Date("2026-07-06T01:00:00Z"),
      ),
    ).toBe("holiday");
  });

  it("returns 'before_open' before the opening bell", () => {
    expect(resolveMarketPhase(calendar, new Date("2026-07-05T23:59:59Z"))).toBe("before_open");
  });

  it("returns 'open' exactly at the opening bell", () => {
    expect(resolveMarketPhase(calendar, openAt)).toBe("open");
  });

  it("returns 'open' during trading hours", () => {
    expect(resolveMarketPhase(calendar, new Date("2026-07-06T03:00:00Z"))).toBe("open");
  });

  it("returns 'after_close' exactly at the closing bell", () => {
    expect(resolveMarketPhase(calendar, closeAt)).toBe("after_close");
  });

  it("returns 'after_close' after the closing bell", () => {
    expect(resolveMarketPhase(calendar, new Date("2026-07-06T07:00:00Z"))).toBe("after_close");
  });

  it("handles early close (E2): 14:00 local on a 13:00-close day is after_close", () => {
    const earlyClose = {
      isTradingDay: true,
      openAt: new Date("2026-12-31T00:00:00Z"), // 09:00 KST
      closeAt: new Date("2026-12-31T04:00:00Z"), // 13:00 KST early close
    };
    // 14:00 KST == 05:00Z
    expect(resolveMarketPhase(earlyClose, new Date("2026-12-31T05:00:00Z"))).toBe("after_close");
  });

  it("stays consistent across US DST transition (absolute timestamps)", () => {
    // 2026-03-09 (day after spring-forward 2026-03-08): NYSE 09:30 EDT == 13:30Z
    const dstDay = {
      isTradingDay: true,
      openAt: new Date("2026-03-09T13:30:00Z"),
      closeAt: new Date("2026-03-09T20:00:00Z"),
    };
    expect(resolveMarketPhase(dstDay, new Date("2026-03-09T13:00:00Z"))).toBe("before_open");
    expect(resolveMarketPhase(dstDay, new Date("2026-03-09T14:00:00Z"))).toBe("open");
    expect(resolveMarketPhase(dstDay, new Date("2026-03-09T20:00:00Z"))).toBe("after_close");
  });
});

describe("normalizeToHourUtc", () => {
  it("truncates minutes/seconds/milliseconds", () => {
    expect(normalizeToHourUtc(new Date("2026-07-06T10:07:33.200Z")).toISOString()).toBe(
      "2026-07-06T10:00:00.000Z",
    );
  });

  it("is idempotent for an exact hour input", () => {
    const exact = new Date("2026-07-06T10:00:00.000Z");
    expect(normalizeToHourUtc(exact).toISOString()).toBe("2026-07-06T10:00:00.000Z");
  });
});

describe("localDayUtcRange", () => {
  it("maps a KRX local date to the correct UTC range", () => {
    const { fromUtc, toUtc } = localDayUtcRange("KRX", "2026-07-06");
    expect(fromUtc.toISOString()).toBe("2026-07-05T15:00:00.000Z");
    expect(toUtc.toISOString()).toBe("2026-07-06T15:00:00.000Z");
  });

  it("maps a US local date to the correct UTC range (EDT)", () => {
    const { fromUtc, toUtc } = localDayUtcRange("US", "2026-07-06");
    expect(fromUtc.toISOString()).toBe("2026-07-06T04:00:00.000Z");
    expect(toUtc.toISOString()).toBe("2026-07-07T04:00:00.000Z");
  });
});
