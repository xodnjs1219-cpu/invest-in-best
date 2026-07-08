import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findByMarketDate } from "./market-calendar.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("findByMarketDate", () => {
  it("returns the calendar row for the market and local date", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        is_trading_day: true,
        open_at: "2026-07-06T00:00:00Z",
        close_at: "2026-07-06T06:30:00Z",
      },
      error: null,
    });
    const eqDate = vi.fn().mockReturnValue({ maybeSingle });
    const eqMarket = vi.fn().mockReturnValue({ eq: eqDate });
    const select = vi.fn().mockReturnValue({ eq: eqMarket });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findByMarketDate(client, "KRX", "2026-07-06");

    expect(from).toHaveBeenCalledWith("market_calendar");
    expect(eqMarket).toHaveBeenCalledWith("market", "KRX");
    expect(eqDate).toHaveBeenCalledWith("calendar_date", "2026-07-06");
    expect(result).toEqual({
      ok: true,
      data: {
        isTradingDay: true,
        openAt: new Date("2026-07-06T00:00:00Z"),
        closeAt: new Date("2026-07-06T06:30:00Z"),
      },
    });
  });

  it("returns {ok:true, data:null} when there is no row (E9 input)", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqDate = vi.fn().mockReturnValue({ maybeSingle });
    const eqMarket = vi.fn().mockReturnValue({ eq: eqDate });
    const select = vi.fn().mockReturnValue({ eq: eqMarket });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findByMarketDate(client, "US", "2026-07-06");
    expect(result).toEqual({ ok: true, data: null });
  });
});
