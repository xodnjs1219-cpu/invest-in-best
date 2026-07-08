import { describe, expect, it } from "vitest";
import { FX_PAIR, MARKETS, MARKET_REGULAR_SESSION_LOCAL, MARKET_TIMEZONES, SHARES_SOURCE_PRIORITY } from "./markets";

describe("markets constants", () => {
  it("MARKET_TIMEZONES keys match MARKETS exactly", () => {
    expect(Object.keys(MARKET_TIMEZONES).sort()).toEqual([...MARKETS].sort());
  });

  it("defines IANA timezones for KRX and US", () => {
    expect(MARKET_TIMEZONES.KRX).toBe("Asia/Seoul");
    expect(MARKET_TIMEZONES.US).toBe("America/New_York");
  });

  it("FX_PAIR is USD base / KRW quote and distinct (chk_fx_pair_distinct guard)", () => {
    expect(FX_PAIR.base).toBe("USD");
    expect(FX_PAIR.quote).toBe("KRW");
    expect(FX_PAIR.base).not.toBe(FX_PAIR.quote);
  });

  it("MARKET_REGULAR_SESSION_LOCAL keys match MARKETS exactly", () => {
    expect(Object.keys(MARKET_REGULAR_SESSION_LOCAL).sort()).toEqual([...MARKETS].sort());
  });

  it("defines the standard regular-session local wall-clock times", () => {
    expect(MARKET_REGULAR_SESSION_LOCAL.KRX).toEqual({ open: "09:00", close: "15:30" });
    expect(MARKET_REGULAR_SESSION_LOCAL.US).toEqual({ open: "09:30", close: "16:00" });
  });

  it("SHARES_SOURCE_PRIORITY lists toss first (0008 §3.5 priority order)", () => {
    expect(SHARES_SOURCE_PRIORITY).toEqual(["toss", "dart", "sec"]);
  });
});
