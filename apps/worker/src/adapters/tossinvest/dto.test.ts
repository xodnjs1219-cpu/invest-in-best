import { describe, expect, it } from "vitest";
import {
  parsePricesResponse,
  parseTossErrorEnvelope,
  priceItemSchema,
  toNormalizedDailyCandle,
  toNormalizedQuote,
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
