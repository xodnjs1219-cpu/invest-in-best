import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findLatestRate, upsertRate } from "./fx.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("upsertRate", () => {
  it("upserts with onConflict 'rate_date,base_currency,quote_currency' (value-updating)", async () => {
    const upsertedRows: unknown[] = [];
    const upsertOptions: unknown[] = [];
    const upsert = vi.fn((row: unknown, options: unknown) => {
      upsertedRows.push(row);
      upsertOptions.push(options);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertRate(client, {
      rateDate: "2026-07-07",
      baseCurrency: "USD",
      quoteCurrency: "KRW",
      rate: 1350.5,
      source: "toss",
    });

    expect(from).toHaveBeenCalledWith("fx_rates");
    expect(upsertedRows[0]).toMatchObject({
      rate_date: "2026-07-07",
      base_currency: "USD",
      quote_currency: "KRW",
      rate: 1350.5,
      source: "toss",
    });
    expect(upsertOptions[0]).toMatchObject({ onConflict: "rate_date,base_currency,quote_currency" });
    expect(upsertOptions[0]).not.toHaveProperty("ignoreDuplicates", true);
    expect(result.ok).toBe(true);
  });

  it("returns {ok:false} on DB error without throwing", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertRate(client, {
      rateDate: "2026-07-07",
      baseCurrency: "USD",
      quoteCurrency: "KRW",
      rate: 1350.5,
      source: "toss",
    });
    expect(result.ok).toBe(false);
  });
});

describe("findLatestRate", () => {
  it("filters by base/quote currency, orders by rate_date desc, limit 1", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { rate_date: "2026-07-06", rate: 1340 }, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqQuote = vi.fn().mockReturnValue({ order: orderFn });
    const eqBase = vi.fn().mockReturnValue({ eq: eqQuote });
    const select = vi.fn().mockReturnValue({ eq: eqBase });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findLatestRate(client, "USD", "KRW");

    expect(from).toHaveBeenCalledWith("fx_rates");
    expect(eqBase).toHaveBeenCalledWith("base_currency", "USD");
    expect(eqQuote).toHaveBeenCalledWith("quote_currency", "KRW");
    expect(orderFn).toHaveBeenCalledWith("rate_date", { ascending: false });
    expect(limitFn).toHaveBeenCalledWith(1);
    expect(result).toEqual({ ok: true, data: { rateDate: "2026-07-06", rate: 1340 } });
  });

  it("returns {ok:true, data:null} when there is no row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqQuote = vi.fn().mockReturnValue({ order: orderFn });
    const eqBase = vi.fn().mockReturnValue({ eq: eqQuote });
    const select = vi.fn().mockReturnValue({ eq: eqBase });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findLatestRate(client, "USD", "KRW");
    expect(result).toEqual({ ok: true, data: null });
  });
});
