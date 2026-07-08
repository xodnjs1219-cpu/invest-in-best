import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteExpiredTicks,
  findUnconfirmedDaily,
  upsertConfirmedDaily,
  upsertProvisionalDaily,
  upsertTicks,
} from "./quotes.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("upsertTicks", () => {
  it("splits 2,500 rows into 1,000/1,000/500 chunks with ignoreDuplicates:true", async () => {
    const rows = Array.from({ length: 2_500 }, (_, i) => ({
      securityId: `sec-${i}`,
      observedAt: "2026-07-06T01:00:00Z",
      price: 100,
      volume: null,
      source: "toss" as const,
    }));
    const upsertCalls: unknown[][] = [];
    const upsert = vi.fn((data: unknown, opts: unknown) => {
      upsertCalls.push([data, opts]);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertTicks(client, rows);

    expect(from).toHaveBeenCalledWith("quote_ticks");
    expect(upsertCalls).toHaveLength(3);
    expect((upsertCalls[0]![0] as unknown[]).length).toBe(1000);
    expect((upsertCalls[1]![0] as unknown[]).length).toBe(1000);
    expect((upsertCalls[2]![0] as unknown[]).length).toBe(500);
    for (const [, opts] of upsertCalls) {
      expect(opts).toMatchObject({ onConflict: "security_id,observed_at", ignoreDuplicates: true });
    }
    expect(result.ok).toBe(true);
  });

  it("returns {ok:false} with failed chunk info when one chunk fails", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "boom" } });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const rows = Array.from({ length: 1_500 }, (_, i) => ({
      securityId: `sec-${i}`,
      observedAt: "2026-07-06T01:00:00Z",
      price: 100,
      volume: null,
      source: "toss" as const,
    }));

    const result = await upsertTicks(client, rows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("boom");
    }
  });
});

describe("upsertProvisionalDaily", () => {
  it("calls the fn_upsert_provisional_daily_quotes RPC with market/date/range params", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 42, error: null });
    const client = makeClient({ rpc });

    const fromUtc = new Date("2026-07-05T15:00:00Z");
    const toUtc = new Date("2026-07-06T15:00:00Z");
    const result = await upsertProvisionalDaily(client, "KRX", "2026-07-06", fromUtc, toUtc);

    expect(rpc).toHaveBeenCalledWith("fn_upsert_provisional_daily_quotes", {
      p_market: "KRX",
      p_trade_date: "2026-07-06",
      p_from: fromUtc.toISOString(),
      p_to: toUtc.toISOString(),
    });
    expect(result).toEqual({ ok: true, data: 42 });
  });
});

describe("findUnconfirmedDaily", () => {
  it("applies market/date/unconfirmed filters and returns symbols", async () => {
    const notFn = vi.fn().mockResolvedValue({
      data: [
        {
          security_id: "sec-1",
          securities: { toss_symbol: "005930", market: "KRX" },
        },
      ],
      error: null,
    });
    const eqMarket = vi.fn().mockReturnValue({ not: notFn });
    const eqConfirmed = vi.fn().mockReturnValue({ eq: eqMarket });
    const eqDate = vi.fn().mockReturnValue({ eq: eqConfirmed });
    const select = vi.fn().mockReturnValue({ eq: eqDate });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findUnconfirmedDaily(client, "KRX", "2026-07-06");

    expect(from).toHaveBeenCalledWith("daily_quotes");
    expect(eqDate).toHaveBeenCalledWith("trade_date", "2026-07-06");
    expect(eqConfirmed).toHaveBeenCalledWith("is_closing_confirmed", false);
    expect(eqMarket).toHaveBeenCalledWith("securities.market", "KRX");
    expect(notFn).toHaveBeenCalledWith("securities.toss_symbol", "is", null);
    expect(result).toEqual({
      ok: true,
      data: [{ securityId: "sec-1", tossSymbol: "005930" }],
    });
  });
});

describe("upsertConfirmedDaily", () => {
  it("upserts is_closing_confirmed:true with onConflict security_id,trade_date", async () => {
    const upsertCalls: unknown[][] = [];
    const upsert = vi.fn((data: unknown, opts: unknown) => {
      upsertCalls.push([data, opts]);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertConfirmedDaily(client, [
      {
        securityId: "sec-1",
        tradeDate: "2026-07-06",
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000,
      },
    ]);

    expect(from).toHaveBeenCalledWith("daily_quotes");
    expect((upsertCalls[0]![0] as Array<Record<string, unknown>>)[0]).toMatchObject({
      security_id: "sec-1",
      trade_date: "2026-07-06",
      is_closing_confirmed: true,
    });
    expect(upsertCalls[0]![1]).toMatchObject({ onConflict: "security_id,trade_date" });
    expect(result.ok).toBe(true);
  });
});

describe("deleteExpiredTicks", () => {
  it("deletes rows below the cutoff timestamp", async () => {
    const lt = vi.fn().mockResolvedValue({ error: null, count: 12 });
    const del = vi.fn().mockReturnValue({ lt });
    const from = vi.fn().mockReturnValue({ delete: del });
    const client = makeClient({ from });

    const cutoff = new Date("2026-06-06T00:00:00Z");
    const result = await deleteExpiredTicks(client, cutoff);

    expect(from).toHaveBeenCalledWith("quote_ticks");
    expect(lt).toHaveBeenCalledWith("observed_at", cutoff.toISOString());
    expect(result).toEqual({ ok: true, data: 12 });
  });
});
