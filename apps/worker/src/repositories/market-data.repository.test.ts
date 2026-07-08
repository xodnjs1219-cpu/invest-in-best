import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findDailyCloses,
  findFxRates,
  findLatestClosesBefore,
  findLatestFxBefore,
  findLatestShares,
  findMinCorrectedFxDateSince,
  findMinCorrectedQuoteDateSince,
  findMinNewSharesAsOfSince,
} from "./market-data.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("findDailyCloses", () => {
  it("applies close_price NOT NULL + date range filters and paginates through 2500 rows", async () => {
    const page0 = Array.from({ length: 1000 }, (_, i) => ({
      security_id: "sec-1",
      trade_date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      close_price: 100,
    }));
    const page1 = Array.from({ length: 1000 }, () => ({ security_id: "sec-1", trade_date: "2026-02-01", close_price: 100 }));
    const page2 = Array.from({ length: 500 }, () => ({ security_id: "sec-1", trade_date: "2026-03-01", close_price: 100 }));

    const rangeFn = vi
      .fn()
      .mockResolvedValueOnce({ data: page0, error: null })
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });
    const orderDate = vi.fn().mockReturnValue({ range: rangeFn });
    const orderSec = vi.fn().mockReturnValue({ order: orderDate });
    const lte = vi.fn().mockReturnValue({ order: orderSec });
    const gte = vi.fn().mockReturnValue({ lte });
    const notFn = vi.fn().mockReturnValue({ gte });
    const inFn = vi.fn().mockReturnValue({ not: notFn });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findDailyCloses(client, ["sec-1"], "2026-01-01", "2026-03-01");

    expect(from).toHaveBeenCalledWith("daily_quotes");
    expect(notFn).toHaveBeenCalledWith("close_price", "is", null);
    expect(gte).toHaveBeenCalledWith("trade_date", "2026-01-01");
    expect(lte).toHaveBeenCalledWith("trade_date", "2026-03-01");
    expect(rangeFn).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2500);
  });

  it("returns an empty array without calling the DB when securityIds is empty", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await findDailyCloses(client, [], "2026-01-01", "2026-03-01");
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe("findLatestShares", () => {
  it("converts the RPC result into a per-security Map", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ security_id: "sec-1", shares: 100, as_of_date: "2026-01-01", source: "toss" }],
      error: null,
    });
    const client = makeClient({ rpc });

    const result = await findLatestShares(client, ["sec-1"]);

    expect(rpc).toHaveBeenCalledWith("fn_latest_shares_outstanding", { p_security_ids: ["sec-1"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.get("sec-1")).toEqual({ securityId: "sec-1", shares: 100, asOfDate: "2026-01-01" });
    }
  });
});

describe("findLatestClosesBefore", () => {
  it("calls the RPC with security ids and the before date", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ security_id: "sec-1", trade_date: "2026-05-01", close_price: 1000 }],
      error: null,
    });
    const client = makeClient({ rpc });

    const result = await findLatestClosesBefore(client, ["sec-1"], "2026-05-03");
    expect(rpc).toHaveBeenCalledWith("fn_latest_daily_closes_before", {
      p_security_ids: ["sec-1"],
      p_before: "2026-05-03",
    });
    expect(result).toEqual({ ok: true, data: [{ securityId: "sec-1", tradeDate: "2026-05-01", closePrice: 1000 }] });
  });
});

describe("findFxRates", () => {
  it("applies FX_PAIR bidirectional filter (base+quote) and a date range", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: [{ rate_date: "2026-05-01", rate: 1300 }], error: null });
    const lte = vi.fn().mockReturnValue({ order: orderFn });
    const gte = vi.fn().mockReturnValue({ lte });
    const eqQuote = vi.fn().mockReturnValue({ gte });
    const eqBase = vi.fn().mockReturnValue({ eq: eqQuote });
    const select = vi.fn().mockReturnValue({ eq: eqBase });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findFxRates(client, { base: "USD", quote: "KRW" }, "2026-05-01", "2026-05-31");

    expect(eqBase).toHaveBeenCalledWith("base_currency", "USD");
    expect(eqQuote).toHaveBeenCalledWith("quote_currency", "KRW");
    expect(result).toEqual({ ok: true, data: [{ rateDate: "2026-05-01", rate: 1300 }] });
  });
});

describe("findLatestFxBefore", () => {
  it("queries the last fx row strictly before the given date", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { rate_date: "2026-04-30", rate: 1290 }, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const lt = vi.fn().mockReturnValue({ order: orderFn });
    const eqQuote = vi.fn().mockReturnValue({ lt });
    const eqBase = vi.fn().mockReturnValue({ eq: eqQuote });
    const select = vi.fn().mockReturnValue({ eq: eqBase });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findLatestFxBefore(client, { base: "USD", quote: "KRW" }, "2026-05-01");
    expect(lt).toHaveBeenCalledWith("rate_date", "2026-05-01");
    expect(result).toEqual({ ok: true, data: { rateDate: "2026-04-30", rate: 1290 } });
  });

  it("returns null when no row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const lt = vi.fn().mockReturnValue({ order: orderFn });
    const eqQuote = vi.fn().mockReturnValue({ lt });
    const eqBase = vi.fn().mockReturnValue({ eq: eqQuote });
    const select = vi.fn().mockReturnValue({ eq: eqBase });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findLatestFxBefore(client, { base: "USD", quote: "KRW" }, "2026-05-01");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("correction watermarks", () => {
  it("findMinCorrectedQuoteDateSince queries updated_at > sinceIso ordered asc limit 1", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { trade_date: "2026-06-20" }, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const gt = vi.fn().mockReturnValue({ order: orderFn });
    const select = vi.fn().mockReturnValue({ gt });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findMinCorrectedQuoteDateSince(client, "2026-07-01T00:00:00Z");
    expect(gt).toHaveBeenCalledWith("updated_at", "2026-07-01T00:00:00Z");
    expect(orderFn).toHaveBeenCalledWith("trade_date", { ascending: true });
    expect(limitFn).toHaveBeenCalledWith(1);
    expect(result).toEqual({ ok: true, data: "2026-06-20" });
  });

  it("returns null when zero rows match (no correction)", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const gt = vi.fn().mockReturnValue({ order: orderFn });
    const select = vi.fn().mockReturnValue({ gt });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findMinCorrectedFxDateSince(client, "2026-07-01T00:00:00Z");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("findMinNewSharesAsOfSince queries updated_at > sinceIso on shares_outstanding", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { as_of_date: "2026-04-01" }, error: null });
    const limitFn = vi.fn().mockReturnValue({ maybeSingle });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const gt = vi.fn().mockReturnValue({ order: orderFn });
    const select = vi.fn().mockReturnValue({ gt });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findMinNewSharesAsOfSince(client, "2026-07-01T00:00:00Z");
    expect(from).toHaveBeenCalledWith("shares_outstanding");
    expect(result).toEqual({ ok: true, data: "2026-04-01" });
  });
});
