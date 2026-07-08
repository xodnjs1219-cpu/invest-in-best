import { describe, expect, it } from "vitest";
import {
  exchangeRateResponseSchema,
  krMarketCalendarResponseSchema,
  parsePricesResponse,
  parseTossErrorEnvelope,
  priceItemSchema,
  stockInfoSchema,
  toNormalizedCalendarDays,
  toNormalizedDailyCandle,
  toNormalizedFxRate,
  toNormalizedQuote,
  toNormalizedStockInfo,
  usMarketCalendarResponseSchema,
  candleSchema,
} from "./dto";

describe("pricesResponseSchema / toNormalizedQuote", () => {
  it("parses a normal prices response and coerces string numbers", () => {
    const raw = {
      prices: [
        { symbol: "005930", lastPrice: "71500", volume: "1234", currency: "KRW" },
        { symbol: "AAPL", lastPrice: 210.5, volume: 999, currency: "USD" },
      ],
    };
    const parsed = parsePricesResponse(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("unreachable");

    const quote = toNormalizedQuote(parsed.data.prices[0]!);
    expect(quote).toEqual({ symbol: "005930", price: 71500, volume: 1234, currency: "KRW" });
  });

  it("classifies an item missing lastPrice as a validation failure", () => {
    const result = priceItemSchema.safeParse({ symbol: "005930", currency: "KRW" });
    expect(result.success).toBe(false);
  });
});

describe("candleSchema / toNormalizedDailyCandle", () => {
  it("converts candle DTO timestamp into the market-local date string", () => {
    const candle = candleSchema.parse({
      timestamp: "2026-07-06T00:00:00Z", // 09:00 KST
      openPrice: 100,
      highPrice: 120,
      lowPrice: 90,
      closePrice: 110,
      volume: 5000,
    });
    const normalized = toNormalizedDailyCandle("005930", candle, "2026-07-06");
    expect(normalized).toEqual({
      symbol: "005930",
      date: "2026-07-06",
      open: 100,
      high: 120,
      low: 90,
      close: 110,
      volume: 5000,
    });
  });
});

describe("stockInfoSchema / toNormalizedStockInfo", () => {
  it("coerces a large sharesOutstanding string into a number", () => {
    const parsed = stockInfoSchema.parse({ symbol: "005930", name: "삼성전자", status: "active", sharesOutstanding: "5919637922" });
    const normalized = toNormalizedStockInfo(parsed);
    expect(normalized).toEqual({ symbol: "005930", sharesOutstanding: 5919637922, status: "active", name: "삼성전자" });
  });

  it("treats a missing sharesOutstanding as null (not a failure)", () => {
    const parsed = stockInfoSchema.parse({ symbol: "005930" });
    const normalized = toNormalizedStockInfo(parsed);
    expect(normalized.sharesOutstanding).toBeNull();
  });
});

describe("exchangeRateResponseSchema / toNormalizedFxRate", () => {
  it("normalizes a KRW-per-USD rate response into the internal model", () => {
    const parsed = exchangeRateResponseSchema.parse({ baseCurrency: "USD", quoteCurrency: "KRW", rate: 1350.5 });
    const normalized = toNormalizedFxRate(parsed, new Date("2026-07-07T08:30:00+09:00"));
    expect(normalized).toEqual({ baseCurrency: "USD", quoteCurrency: "KRW", rate: 1350.5, rateDate: "2026-07-07" });
  });

  it("coerces a string rate value into a number", () => {
    const parsed = exchangeRateResponseSchema.parse({ baseCurrency: "USD", quoteCurrency: "KRW", rate: "1350.5" });
    expect(parsed.rate).toBe(1350.5);
  });

  it("rejects a non-positive rate value", () => {
    const result = exchangeRateResponseSchema.safeParse({ baseCurrency: "USD", quoteCurrency: "KRW", rate: 0 });
    expect(result.success).toBe(false);
  });
});

describe("krMarketCalendarResponseSchema / toNormalizedCalendarDays", () => {
  it("converts a normal trading day into an absolute-time normalized row", () => {
    const parsed = krMarketCalendarResponseSchema.parse({
      days: [
        {
          date: "2026-07-07",
          isTradingDay: true,
          regularMarketSession: { openTime: "09:00", closeTime: "15:30" },
        },
      ],
    });
    const days = toNormalizedCalendarDays("KRX", parsed);
    expect(days).toEqual([
      {
        market: "KRX",
        calendarDate: "2026-07-07",
        isTradingDay: true,
        openAt: new Date("2026-07-07T00:00:00Z"),
        closeAt: new Date("2026-07-07T06:30:00Z"),
        isEarlyClose: false,
      },
    ]);
  });

  it("forces openAt/closeAt to null for a holiday even if time fields are present", () => {
    const parsed = krMarketCalendarResponseSchema.parse({
      days: [{ date: "2026-07-11", isTradingDay: false, regularMarketSession: { openTime: "09:00", closeTime: "15:30" } }],
    });
    const days = toNormalizedCalendarDays("KRX", parsed);
    expect(days[0]).toMatchObject({ isTradingDay: false, openAt: null, closeAt: null });
  });

  it("passes through unknown NXT session fields (schema tolerance)", () => {
    const result = krMarketCalendarResponseSchema.safeParse({
      days: [
        {
          date: "2026-07-07",
          isTradingDay: true,
          regularMarketSession: { openTime: "09:00", closeTime: "15:30" },
          nxtSession: { openTime: "08:00", closeTime: "20:00" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("usMarketCalendarResponseSchema / toNormalizedCalendarDays", () => {
  it("applies an explicit early-close flag from the response", () => {
    const parsed = usMarketCalendarResponseSchema.parse({
      days: [
        {
          date: "2026-11-27",
          isTradingDay: true,
          isEarlyClose: true,
          regularMarketSession: { openTime: "09:30", closeTime: "13:00" },
        },
      ],
    });
    const days = toNormalizedCalendarDays("US", parsed);
    expect(days[0]).toMatchObject({ isEarlyClose: true });
    expect(days[0]?.closeAt?.toISOString()).toBe("2026-11-27T18:00:00.000Z"); // 13:00 EST -> 18:00Z
  });

  it("derives early close from the regular schedule when the flag is absent", () => {
    const parsed = usMarketCalendarResponseSchema.parse({
      days: [{ date: "2026-11-27", isTradingDay: true, regularMarketSession: { openTime: "09:30", closeTime: "13:00" } }],
    });
    const days = toNormalizedCalendarDays("US", parsed);
    expect(days[0]?.isEarlyClose).toBe(true);
  });

  it("classifies an open>=close logical contradiction as a validation failure", () => {
    const result = usMarketCalendarResponseSchema.safeParse({
      days: [{ date: "2026-07-07", isTradingDay: true, regularMarketSession: { openTime: "16:00", closeTime: "09:30" } }],
    });
    // Schema itself doesn't reject this (time strings are free-form); the conversion function must catch it.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(() => toNormalizedCalendarDays("US", result.data)).not.toThrow();
      const days = toNormalizedCalendarDays("US", result.data);
      expect(days).toEqual([]); // contradictory day dropped, not silently accepted
    }
  });
});

describe("parseTossErrorEnvelope", () => {
  it("extracts code/message and tolerates unknown fields", () => {
    const raw = {
      error: {
        requestId: "req-1",
        code: "stock-not-found",
        message: "not found",
        data: { unexpected: "field" },
      },
    };
    const parsed = parseTossErrorEnvelope(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("unreachable");
    expect(parsed.data.error.code).toBe("stock-not-found");
    expect(parsed.data.error.message).toBe("not found");
  });

  it("returns a discriminated failure (not a throw) for malformed JSON shape", () => {
    const parsed = parseTossErrorEnvelope("not-an-object");
    expect(parsed.ok).toBe(false);
  });
});
