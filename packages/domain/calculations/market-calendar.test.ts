import { describe, expect, it } from "vitest";
import { deriveEarlyClose, resolveFxRateDate, toAbsoluteSessionTime } from "./market-calendar";

describe("toAbsoluteSessionTime", () => {
  it("converts KRX 09:00 local time to its UTC instant", () => {
    expect(toAbsoluteSessionTime("KRX", "2026-07-07", "09:00").toISOString()).toBe(
      "2026-07-07T00:00:00.000Z",
    );
  });

  it("converts US 09:30 ET to UTC across DST boundaries (EDT vs EST)", () => {
    expect(toAbsoluteSessionTime("US", "2026-07-07", "09:30").toISOString()).toBe(
      "2026-07-07T13:30:00.000Z",
    ); // EDT (summer)
    expect(toAbsoluteSessionTime("US", "2026-12-07", "09:30").toISOString()).toBe(
      "2026-12-07T14:30:00.000Z",
    ); // EST (winter)
  });
});

describe("deriveEarlyClose", () => {
  it("flags a Black-Friday-style early close (13:00 ET vs 16:00 ET regular close)", () => {
    const earlyCloseAt = toAbsoluteSessionTime("US", "2026-11-27", "13:00");
    expect(deriveEarlyClose("US", "2026-11-27", earlyCloseAt)).toBe(true);
  });

  it("returns false for a regular 16:00 ET close", () => {
    const regularCloseAt = toAbsoluteSessionTime("US", "2026-11-27", "16:00");
    expect(deriveEarlyClose("US", "2026-11-27", regularCloseAt)).toBe(false);
  });

  it("returns false for a regular KRX 15:30 KST close", () => {
    const closeAt = toAbsoluteSessionTime("KRX", "2026-07-07", "15:30");
    expect(deriveEarlyClose("KRX", "2026-07-07", closeAt)).toBe(false);
  });
});

describe("resolveFxRateDate", () => {
  it("resolves to the KST calendar date, crossing the midnight boundary from UTC", () => {
    // 2026-07-06T23:30:00Z = 2026-07-07 08:30 KST
    expect(resolveFxRateDate(new Date("2026-07-06T23:30:00Z"))).toBe("2026-07-07");
    expect(resolveFxRateDate(new Date("2026-07-07T02:00:00Z"))).toBe("2026-07-07");
  });
});
