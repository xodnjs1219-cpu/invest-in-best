import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findByMarketDate, upsertDays } from "./market-calendar.repository";

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

describe("upsertDays", () => {
  it("upserts with onConflict 'market,calendar_date' (value-updating, not ignoreDuplicates)", async () => {
    const upsertedRows: unknown[] = [];
    const upsertOptions: unknown[] = [];
    const upsert = vi.fn((rows: unknown, options: unknown) => {
      upsertedRows.push(rows);
      upsertOptions.push(options);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertDays(client, [
      {
        market: "KRX",
        calendarDate: "2026-07-06",
        isTradingDay: true,
        openAt: new Date("2026-07-06T00:00:00Z"),
        closeAt: new Date("2026-07-06T06:30:00Z"),
        isEarlyClose: false,
      },
    ]);

    expect(from).toHaveBeenCalledWith("market_calendar");
    const rows = upsertedRows[0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      market: "KRX",
      calendar_date: "2026-07-06",
      is_trading_day: true,
      is_early_close: false,
    });
    expect(upsertOptions[0]).toMatchObject({ onConflict: "market,calendar_date" });
    expect(upsertOptions[0]).not.toHaveProperty("ignoreDuplicates", true);
    expect(result.ok).toBe(true);
  });

  it("serializes a holiday row with null open_at/close_at", async () => {
    const upsertedRows: unknown[] = [];
    const upsert = vi.fn((rows: unknown) => {
      upsertedRows.push(rows);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    await upsertDays(client, [
      { market: "KRX", calendarDate: "2026-07-11", isTradingDay: false, openAt: null, closeAt: null, isEarlyClose: false },
    ]);

    const rows = upsertedRows[0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ open_at: null, close_at: null });
  });

  it("is a no-op success for an empty array (no DB call)", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await upsertDays(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: { count: 0 } });
  });

  it("returns {ok:false} on DB error", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertDays(client, [
      { market: "US", calendarDate: "2026-07-06", isTradingDay: true, openAt: new Date(), closeAt: new Date(), isEarlyClose: false },
    ]);
    expect(result.ok).toBe(false);
  });
});
