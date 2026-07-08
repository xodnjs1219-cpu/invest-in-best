import { describe, expect, it } from "vitest";
import { MARKETS, MARKET_TIMEZONES } from "./markets";

describe("markets constants", () => {
  it("MARKET_TIMEZONES keys match MARKETS exactly", () => {
    expect(Object.keys(MARKET_TIMEZONES).sort()).toEqual([...MARKETS].sort());
  });

  it("defines IANA timezones for KRX and US", () => {
    expect(MARKET_TIMEZONES.KRX).toBe("Asia/Seoul");
    expect(MARKET_TIMEZONES.US).toBe("America/New_York");
  });
});
