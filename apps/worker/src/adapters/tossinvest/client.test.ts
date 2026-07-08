import { describe, expect, it, vi } from "vitest";
import { createTossInvestClient } from "./client";
import { createRateLimiter } from "../../runtime/rate-limiter";
import { TossAuthError, TossRequestError } from "./contract";
import type { WorkerConfig } from "../../runtime/config";

const config: WorkerConfig = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role-key",
  tossClientId: "client-id",
  tossClientSecret: "client-secret",
  opendartApiKey: "a".repeat(40),
  secEdgarUserAgent: "InvestInBest admin@example.com",
  workerTmpDir: undefined,
};

function makeClock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    clock: {
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        now += ms;
      },
    },
    sleeps,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function tokenBody(overrides: Partial<{ access_token: string; expires_in: number }> = {}) {
  return {
    access_token: overrides.access_token ?? "token-1",
    expires_in: overrides.expires_in ?? 3600,
    token_type: "Bearer",
  };
}

function pricesBody(items: Array<{ symbol: string; lastPrice: number | string; volume?: number; currency?: string }>) {
  return { prices: items };
}

function makeRateLimiter(clock: ReturnType<typeof makeClock>["clock"]) {
  return createRateLimiter({
    groups: { AUTH: { tps: 5 }, MARKET_DATA: { tps: 10 }, MARKET_DATA_CHART: { tps: 5 } },
    clock,
  });
}

describe("createTossInvestClient — token management", () => {
  it("fetches a token on first call and reuses the cache within its lifetime", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(jsonResponse(pricesBody([{ symbol: "005930", lastPrice: 100 }])))
      .mockResolvedValueOnce(jsonResponse(pricesBody([{ symbol: "005930", lastPrice: 101 }])));

    const client = createTossInvestClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
    });

    await client.getPrices(["005930"]);
    await client.getPrices(["005930"]);

    const tokenCalls = fetchImpl.mock.calls.filter(([url]) => String(url).includes("/oauth2/token"));
    expect(tokenCalls).toHaveLength(1);
  });

  it("proactively re-issues the token shortly before expiry (fake timer)", async () => {
    const { clock, advance } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tokenBody({ expires_in: 60 })))
      .mockResolvedValueOnce(jsonResponse(pricesBody([{ symbol: "005930", lastPrice: 100 }])))
      .mockResolvedValueOnce(jsonResponse(tokenBody({ access_token: "token-2" })))
      .mockResolvedValueOnce(jsonResponse(pricesBody([{ symbol: "005930", lastPrice: 101 }])));

    const client = createTossInvestClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
    });

    await client.getPrices(["005930"]);
    advance(59_000); // within 60s expiry, past the 60s-before-expiry safety margin trigger point
    await client.getPrices(["005930"]);

    const tokenCalls = fetchImpl.mock.calls.filter(([url]) => String(url).includes("/oauth2/token"));
    expect(tokenCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("re-issues the token once on 401 expired-token and retries the same chunk successfully", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: "expired-token", message: "expired", requestId: "r1" } },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse(tokenBody({ access_token: "token-2" })))
      .mockResolvedValueOnce(jsonResponse(pricesBody([{ symbol: "005930", lastPrice: 100 }])));

    const client = createTossInvestClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
    });

    const result = await client.getPrices(["005930"]);
    expect(result.quotes).toEqual([{ symbol: "005930", price: 100, volume: null, currency: "KRW" }]);
  });

  it("throws TossAuthError when re-issuing the token also fails (E5)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "invalid-request", message: "bad creds" } }, { status: 400 }),
      );

    const client = createTossInvestClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
    });

    await expect(client.getPrices(["005930"])).rejects.toThrow(TossAuthError);
  });
});

describe("createTossInvestClient — getPrices chunking & rate limit", () => {
  it("splits 450 symbols into 200/200/50 chunks", async () => {
    const { clock } = makeClock();
    const symbols = Array.from({ length: 450 }, (_, i) => `SYM${i}`);
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse(pricesBody([])));
    });

    const client = createTossInvestClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
    });

    await client.getPrices(symbols);

    const priceCalls = fetchImpl.mock.calls.filter(([url]) => String(url).includes("/api/v1/prices"));
    expect(priceCalls).toHaveLength(3);
    const sizes = priceCalls.map(([url]) => {
      const u = new URL(String(url));
      return u.searchParams.get("symbols")!.split(",").length;
    });
    expect(sizes).toEqual([200, 200, 50]);
  });

  it("calls acquire('MARKET_DATA') per chunk and feeds back rate-limit headers", async () => {
    const { clock } = makeClock();
    const rateLimiter = makeRateLimiter(clock);
    const acquireSpy = vi.spyOn(rateLimiter, "acquire");
    const feedbackSpy = vi.spyOn(rateLimiter, "feedback");

    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse(pricesBody([{ symbol: "005930", lastPrice: 100 }]), {
          headers: { "X-RateLimit-Limit": "10", "X-RateLimit-Remaining": "9", "X-RateLimit-Reset": "1" },
        }),
      );
    });

    const client = createTossInvestClient({ config, rateLimiter, fetchImpl, clock });
    await client.getPrices(["005930"]);

    expect(acquireSpy).toHaveBeenCalledWith("MARKET_DATA");
    expect(feedbackSpy).toHaveBeenCalledWith(
      "MARKET_DATA",
      expect.objectContaining({ limit: 10, remaining: 9, reset: 1 }),
    );
  });

  it("waits per Retry-After on 429, carries the chunk over after exhausting retries, and continues with the next chunk (E3)", async () => {
    const { clock, sleeps } = makeClock();
    const symbols = [...Array.from({ length: 200 }, (_, i) => `A${i}`), "B0"];
    const rateLimit429 = () =>
      jsonResponse(
        { error: { code: "rate-limit-exceeded", message: "too many requests" } },
        { status: 429, headers: { "Retry-After": "2" } },
      );

    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      const u = new URL(String(url));
      const requestedSymbols = u.searchParams.get("symbols")!.split(",");
      if (requestedSymbols[0] === "A0") return Promise.resolve(rateLimit429());
      return Promise.resolve(jsonResponse(pricesBody([{ symbol: "B0", lastPrice: 50 }])));
    });

    const client = createTossInvestClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
      retryOptions: { retries: 3, sleep: clock.sleep },
    });

    const result = await client.getPrices(symbols);

    expect(sleeps.some((ms) => ms === 2_000)).toBe(true);
    expect(result.carriedOverSymbols).toEqual(expect.arrayContaining(symbols.slice(0, 200)));
    expect(result.quotes).toEqual(
      expect.arrayContaining([{ symbol: "B0", price: 50, volume: null, currency: "KRW" }]),
    );
  });

  it("classifies a missing requested symbol as not_found and an invalid item as validation_failed (E4/E11)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({
          prices: [
            { symbol: "005930", lastPrice: 100 },
            { symbol: "000660" }, // missing lastPrice -> validation_failed
          ],
        }),
      );
    });

    const client = createTossInvestClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
    });

    const result = await client.getPrices(["005930", "000660", "035420"]); // 035420 missing in response -> not_found

    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: "000660", reason: "validation_failed" }),
        expect.objectContaining({ symbol: "035420", reason: "not_found" }),
      ]),
    );
  });
});

describe("createTossInvestClient — getConfirmedDailyCandle", () => {
  it("returns the normalized candle when the latest bar matches localDate", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({
          candles: [
            {
              timestamp: "2026-07-06T00:00:00Z", // 09:00 KST
              openPrice: 100,
              highPrice: 110,
              lowPrice: 95,
              closePrice: 105,
              volume: 1000,
            },
          ],
          nextBefore: null,
        }),
      );
    });

    const client = createTossInvestClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });
    const candle = await client.getConfirmedDailyCandle("005930", "2026-07-06", "KRX");

    expect(candle).toEqual({
      symbol: "005930",
      date: "2026-07-06",
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 1000,
    });
  });

  it("returns null when the latest bar's local date does not match (E10, not yet published)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({
          candles: [
            {
              timestamp: "2026-07-05T00:00:00Z", // previous local day
              openPrice: 100,
              highPrice: 110,
              lowPrice: 95,
              closePrice: 105,
              volume: 1000,
            },
          ],
          nextBefore: null,
        }),
      );
    });

    const client = createTossInvestClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });
    const candle = await client.getConfirmedDailyCandle("005930", "2026-07-06", "KRX");
    expect(candle).toBeNull();
  });

  it("returns null for an empty candles array", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ candles: [], nextBefore: null }));
    });

    const client = createTossInvestClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });
    expect(await client.getConfirmedDailyCandle("005930", "2026-07-06", "KRX")).toBeNull();
  });

  it("throws TossRequestError (no retry) on 404 stock-not-found", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({ error: { code: "stock-not-found", message: "no such stock" } }, { status: 404 }),
      );
    });

    const client = createTossInvestClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });
    await expect(client.getConfirmedDailyCandle("XXXXXX", "2026-07-06", "KRX")).rejects.toThrow(
      TossRequestError,
    );
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes("/api/v1/candles"))).toHaveLength(1);
  });

  it("uses the US market timezone (not KST) to resolve the candle's local date", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({
          candles: [
            {
              // 2026-07-06T01:00:00Z is 2026-07-05 21:00 in New York (EDT) but 2026-07-06 10:00 KST.
              // A KST-based comparison would wrongly match "2026-07-06"; US tz correctly resolves "2026-07-05".
              timestamp: "2026-07-06T01:00:00Z",
              openPrice: 200,
              highPrice: 210,
              lowPrice: 195,
              closePrice: 205,
              volume: 500,
            },
          ],
          nextBefore: null,
        }),
      );
    });

    const client = createTossInvestClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    // Requesting "2026-07-06" under US tz should NOT match (candle is actually 2026-07-05 in NY).
    expect(await client.getConfirmedDailyCandle("AAPL", "2026-07-06", "US")).toBeNull();
    // Requesting "2026-07-05" under US tz should match.
    const candle = await client.getConfirmedDailyCandle("AAPL", "2026-07-05", "US");
    expect(candle).toEqual({
      symbol: "AAPL",
      date: "2026-07-05",
      open: 200,
      high: 210,
      low: 195,
      close: 205,
      volume: 500,
    });
  });

  it("retries after 5xx and returns normally on eventual success (E13)", async () => {
    const { clock, sleeps } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "internal-error", message: "oops" } }, { status: 500 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          candles: [
            {
              timestamp: "2026-07-06T00:00:00Z",
              openPrice: 1,
              highPrice: 2,
              lowPrice: 0.5,
              closePrice: 1.5,
              volume: 10,
            },
          ],
          nextBefore: null,
        }),
      );

    const client = createTossInvestClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
      retryOptions: { retries: 3, sleep: clock.sleep },
    });

    const candle = await client.getConfirmedDailyCandle("005930", "2026-07-06", "KRX");
    expect(candle).not.toBeNull();
    expect(sleeps.length).toBeGreaterThan(0);
  });
});

describe("createTossInvestClient — getExchangeRate / getMarketCalendar (UC-028)", () => {
  function makeMarketInfoRateLimiter(clock: ReturnType<typeof makeClock>["clock"]) {
    return createRateLimiter({
      groups: { AUTH: { tps: 5 }, MARKET_DATA: { tps: 10 }, MARKET_DATA_CHART: { tps: 5 }, MARKET_INFO: { tps: 3 } },
      clock,
    });
  }

  it("getExchangeRate acquires MARKET_INFO and returns {kind:'ok'} with the normalized rate", async () => {
    const { clock } = makeClock();
    const rateLimiter = makeMarketInfoRateLimiter(clock);
    const acquireSpy = vi.spyOn(rateLimiter, "acquire");
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ baseCurrency: "USD", quoteCurrency: "KRW", rate: 1350.5 }));
    });
    const client = createTossInvestClient({ config, rateLimiter, fetchImpl, clock });

    const result = await client.getExchangeRate(new Date("2026-07-07T08:30:00+09:00"));

    expect(acquireSpy).toHaveBeenCalledWith("MARKET_INFO");
    expect(result).toEqual({
      kind: "ok",
      rate: { baseCurrency: "USD", quoteCurrency: "KRW", rate: 1350.5, rateDate: "2026-07-07" },
    });
  });

  it("getExchangeRate returns {kind:'not_published'} on 404 exchange-rate-not-found without retrying", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({ error: { code: "exchange-rate-not-found", message: "no rate" } }, { status: 404 }),
      );
    });
    const client = createTossInvestClient({ config, rateLimiter: makeMarketInfoRateLimiter(clock), fetchImpl, clock });

    const result = await client.getExchangeRate(new Date("2026-07-07T08:30:00+09:00"));
    expect(result).toEqual({ kind: "not_published" });
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes("/api/v1/exchange-rate"))).toHaveLength(1);
  });

  it("getExchangeRate retries on 429 with Retry-After and eventually succeeds", async () => {
    const { clock, sleeps } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: "rate-limit-exceeded", message: "slow down" } },
          { status: 429, headers: { "Retry-After": "2" } },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ baseCurrency: "USD", quoteCurrency: "KRW", rate: 1300 }));

    const client = createTossInvestClient({
      config,
      rateLimiter: makeMarketInfoRateLimiter(clock),
      fetchImpl,
      clock,
      retryOptions: { retries: 3, sleep: clock.sleep },
    });

    const result = await client.getExchangeRate(new Date("2026-07-07T08:30:00+09:00"));
    expect(sleeps.some((ms) => ms === 2_000)).toBe(true);
    expect(result).toEqual({ kind: "ok", rate: expect.objectContaining({ rate: 1300 }) });
  });

  it("getExchangeRate throws a non-retryable error on schema validation failure", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ rate: -1 })); // invalid: negative + missing currencies
    });
    const client = createTossInvestClient({ config, rateLimiter: makeMarketInfoRateLimiter(clock), fetchImpl, clock });

    await expect(client.getExchangeRate(new Date())).rejects.toThrow();
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes("/api/v1/exchange-rate"))).toHaveLength(1);
  });

  it("getExchangeRate re-issues the token on 401 expired-token and retries", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "expired-token", message: "expired" } }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse(tokenBody({ access_token: "token-2" })))
      .mockResolvedValueOnce(jsonResponse({ baseCurrency: "USD", quoteCurrency: "KRW", rate: 1300 }));

    const client = createTossInvestClient({ config, rateLimiter: makeMarketInfoRateLimiter(clock), fetchImpl, clock });
    const result = await client.getExchangeRate(new Date());
    expect(result).toEqual({ kind: "ok", rate: expect.objectContaining({ rate: 1300 }) });
  });

  it("getMarketCalendar('KRX') calls /api/v1/market-calendar/KR", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({
          days: [{ date: "2026-07-07", isTradingDay: true, regularMarketSession: { openTime: "09:00", closeTime: "15:30" } }],
        }),
      );
    });
    const client = createTossInvestClient({ config, rateLimiter: makeMarketInfoRateLimiter(clock), fetchImpl, clock });

    await client.getMarketCalendar("KRX", new Date());

    const calendarCalls = fetchImpl.mock.calls.filter(([url]) => String(url).includes("/api/v1/market-calendar/"));
    expect(calendarCalls).toHaveLength(1);
    expect(String(calendarCalls[0]![0])).toContain("/api/v1/market-calendar/KR");
  });

  it("getMarketCalendar('US') calls /api/v1/market-calendar/US and returns normalized days with absolute times", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({
          days: [
            { date: "2026-07-07", isTradingDay: true, regularMarketSession: { openTime: "09:30", closeTime: "16:00" } },
            { date: "2026-07-08", isTradingDay: false },
          ],
        }),
      );
    });
    const client = createTossInvestClient({ config, rateLimiter: makeMarketInfoRateLimiter(clock), fetchImpl, clock });

    const days = await client.getMarketCalendar("US", new Date());
    expect(String(fetchImpl.mock.calls.find(([url]) => String(url).includes("market-calendar"))?.[0])).toContain(
      "/api/v1/market-calendar/US",
    );
    expect(days).toHaveLength(2);
    expect(days[0]?.isTradingDay).toBe(true);
    expect(days[1]).toMatchObject({ isTradingDay: false, openAt: null, closeAt: null });
  });

  it("getMarketCalendar throws a non-retryable error on validation/conversion failure", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ notDays: [] }));
    });
    const client = createTossInvestClient({ config, rateLimiter: makeMarketInfoRateLimiter(clock), fetchImpl, clock });

    await expect(client.getMarketCalendar("KRX", new Date())).rejects.toThrow();
  });

  it("shares the MARKET_INFO bucket across the three calls without exceeding 3 TPS", async () => {
    const { clock } = makeClock();
    const rateLimiter = makeMarketInfoRateLimiter(clock);
    const acquireSpy = vi.spyOn(rateLimiter, "acquire");
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      if (String(url).includes("exchange-rate")) {
        return Promise.resolve(jsonResponse({ baseCurrency: "USD", quoteCurrency: "KRW", rate: 1300 }));
      }
      return Promise.resolve(jsonResponse({ days: [] }));
    });
    const client = createTossInvestClient({ config, rateLimiter, fetchImpl, clock });

    await client.getExchangeRate(new Date());
    await client.getMarketCalendar("KRX", new Date());
    await client.getMarketCalendar("US", new Date());

    const marketInfoCalls = acquireSpy.mock.calls.filter(([group]) => group === "MARKET_INFO");
    expect(marketInfoCalls).toHaveLength(3);
  });
});

describe("createTossInvestClient — getStockInfos (UC-027 shares_outstanding)", () => {
  function makeStockRateLimiter(clock: ReturnType<typeof makeClock>["clock"]) {
    return createRateLimiter({
      groups: { AUTH: { tps: 5 }, MARKET_DATA: { tps: 10 }, MARKET_DATA_CHART: { tps: 5 }, STOCK: { tps: 5 } },
      clock,
    });
  }

  it("splits 450 symbols into 200/200/50 chunks, each preceded by acquire('STOCK')", async () => {
    const { clock } = makeClock();
    const symbols = Array.from({ length: 450 }, (_, i) => `SYM${i}`);
    const rateLimiter = makeStockRateLimiter(clock);
    const acquireSpy = vi.spyOn(rateLimiter, "acquire");
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ stocks: [] }));
    });

    const client = createTossInvestClient({ config, rateLimiter, fetchImpl, clock });
    await client.getStockInfos(symbols);

    const stockCalls = fetchImpl.mock.calls.filter(([url]) => String(url).includes("/api/v1/stocks"));
    expect(stockCalls).toHaveLength(3);
    const sizes = stockCalls.map(([url]) => new URL(String(url)).searchParams.get("symbols")!.split(",").length);
    expect(sizes).toEqual([200, 200, 50]);
    expect(acquireSpy).toHaveBeenCalledWith("STOCK");
  });

  it("coerces a large sharesOutstanding string to a number", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({ stocks: [{ symbol: "005930", name: "삼성전자", status: "active", sharesOutstanding: "5919637922" }] }),
      );
    });
    const client = createTossInvestClient({ config, rateLimiter: makeStockRateLimiter(clock), fetchImpl, clock });

    const result = await client.getStockInfos(["005930"]);
    expect(result.infos).toEqual([
      { symbol: "005930", sharesOutstanding: 5919637922, status: "active", name: "삼성전자" },
    ]);
  });

  it("includes a missing sharesOutstanding item as null (not a failure — 029 decides exclusion)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ stocks: [{ symbol: "005930" }] }));
    });
    const client = createTossInvestClient({ config, rateLimiter: makeStockRateLimiter(clock), fetchImpl, clock });

    const result = await client.getStockInfos(["005930"]);
    expect(result.infos).toEqual([{ symbol: "005930", sharesOutstanding: null, status: "unknown", name: "" }]);
    expect(result.failures).toEqual([]);
  });

  it("carries over a chunk that keeps failing with 429 (E10) and continues with the next chunk", async () => {
    const { clock, sleeps } = makeClock();
    const symbols = [...Array.from({ length: 200 }, (_, i) => `A${i}`), "B0"];
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      const u = new URL(url);
      const requested = u.searchParams.get("symbols")!.split(",");
      if (requested[0] === "A0") {
        return Promise.resolve(
          jsonResponse(
            { error: { code: "rate-limit-exceeded", message: "too many requests" } },
            { status: 429, headers: { "Retry-After": "2" } },
          ),
        );
      }
      return Promise.resolve(jsonResponse({ stocks: [{ symbol: "B0", sharesOutstanding: "50" }] }));
    });

    const client = createTossInvestClient({
      config,
      rateLimiter: makeStockRateLimiter(clock),
      fetchImpl,
      clock,
      retryOptions: { retries: 3, sleep: clock.sleep },
    });

    const result = await client.getStockInfos(symbols);
    expect(sleeps.some((ms) => ms === 2_000)).toBe(true);
    expect(result.carriedOverSymbols).toEqual(expect.arrayContaining(symbols.slice(0, 200)));
    expect(result.infos).toEqual(expect.arrayContaining([{ symbol: "B0", sharesOutstanding: 50, status: "unknown", name: "" }]));
  });

  it("re-issues the token on 401 expired-token and retries", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tokenBody()))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "expired-token", message: "expired" } }, { status: 401 }),
      )
      .mockResolvedValueOnce(jsonResponse(tokenBody({ access_token: "token-2" })))
      .mockResolvedValueOnce(jsonResponse({ stocks: [{ symbol: "005930", sharesOutstanding: "100" }] }));

    const client = createTossInvestClient({
      config,
      rateLimiter: makeStockRateLimiter(clock),
      fetchImpl,
      clock,
    });

    const result = await client.getStockInfos(["005930"]);
    expect(result.infos).toEqual([{ symbol: "005930", sharesOutstanding: 100, status: "unknown", name: "" }]);
  });
});

describe("createTossInvestClient — getStocks (UC-031 Phase 0 seed)", () => {
  function makeStockRateLimiter(clock: ReturnType<typeof makeClock>["clock"]) {
    return createRateLimiter({
      groups: { AUTH: { tps: 5 }, MARKET_DATA: { tps: 10 }, MARKET_DATA_CHART: { tps: 5 }, STOCK: { tps: 5 } },
      clock,
    });
  }

  it("splits symbols into 200-sized chunks acquiring the STOCK rate limit group", async () => {
    const { clock } = makeClock();
    const symbols = Array.from({ length: 250 }, (_, i) => `SYM${i}`);
    const rateLimiter = makeStockRateLimiter(clock);
    const acquireSpy = vi.spyOn(rateLimiter, "acquire");
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ stocks: [] }));
    });

    const client = createTossInvestClient({ config, rateLimiter, fetchImpl, clock });
    await client.getStocks(symbols);

    const stockCalls = fetchImpl.mock.calls.filter(([url]) => String(url).includes("/api/v1/stocks"));
    expect(stockCalls).toHaveLength(2);
    expect(acquireSpy).toHaveBeenCalledWith("STOCK");
  });

  it("normalizes full structured fields (name/englishName/listDate/isinCode/securityType)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({
          stocks: [
            {
              symbol: "005930",
              name: "삼성전자",
              englishName: "Samsung Electronics",
              status: "active",
              sharesOutstanding: "5919637922",
              listDate: "1975-06-11",
              isinCode: "KR7005930003",
              securityType: "EQUITY",
            },
          ],
        }),
      );
    });
    const client = createTossInvestClient({ config, rateLimiter: makeStockRateLimiter(clock), fetchImpl, clock });

    const result = await client.getStocks(["005930"]);
    expect(result.stocks).toEqual([
      {
        symbol: "005930",
        name: "삼성전자",
        englishName: "Samsung Electronics",
        status: "active",
        sharesOutstanding: 5919637922,
        listDate: "1975-06-11",
        delistDate: null,
        isinCode: "KR7005930003",
        securityType: "EQUITY",
      },
    ]);
  });

  it("marks a symbol missing from the response as a not_found failure (H-5 — not an error)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ stocks: [] }));
    });
    const client = createTossInvestClient({ config, rateLimiter: makeStockRateLimiter(clock), fetchImpl, clock });

    const result = await client.getStocks(["999999"]);
    expect(result.stocks).toEqual([]);
    expect(result.failures).toEqual([{ symbol: "999999", reason: "not_found", message: "response missing symbol" }]);
  });
});

describe("createTossInvestClient — getDailyCandlesPage (UC-031 Phase 1 backfill)", () => {
  it("requests interval=1d, count=200, adjusted=true and forwards the before cursor", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ candles: [], nextBefore: null }));
    });
    const client = createTossInvestClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    await client.getDailyCandlesPage("005930", "2026-07-01T00:00:00Z");

    const [url] = fetchImpl.mock.calls.find(([u]) => String(u).includes("/api/v1/candles"))!;
    const params = new URL(String(url)).searchParams;
    expect(params.get("interval")).toBe("1d");
    expect(params.get("count")).toBe("200");
    expect(params.get("adjusted")).toBe("true");
    expect(params.get("before")).toBe("2026-07-01T00:00:00Z");
  });

  it("omits the before param on the first page (no cursor yet)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ candles: [], nextBefore: null }));
    });
    const client = createTossInvestClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    await client.getDailyCandlesPage("005930");

    const [url] = fetchImpl.mock.calls.find(([u]) => String(u).includes("/api/v1/candles"))!;
    expect(new URL(String(url)).searchParams.has("before")).toBe(false);
  });

  it("returns normalized candles and the nextBefore cursor for pagination", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(
        jsonResponse({
          candles: [
            { timestamp: "2026-07-06T00:00:00Z", openPrice: 100, highPrice: 110, lowPrice: 95, closePrice: 105, volume: 1000 },
          ],
          nextBefore: "2026-07-05T00:00:00Z",
        }),
      );
    });
    const client = createTossInvestClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const page = await client.getDailyCandlesPage("005930", "2026-07-06T00:00:00Z");
    expect(page.nextBefore).toBe("2026-07-05T00:00:00Z");
    expect(page.candles).toHaveLength(1);
    expect(page.candles[0]).toMatchObject({ symbol: "005930", open: 100, close: 105 });
  });

  it("returns nextBefore: null on an empty page (E7 — end-of-history, not an error)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ candles: [], nextBefore: null }));
    });
    const client = createTossInvestClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const page = await client.getDailyCandlesPage("005930", "2026-01-01T00:00:00Z");
    expect(page.candles).toEqual([]);
    expect(page.nextBefore).toBeNull();
  });

  it("acquires the MARKET_DATA_CHART rate limit group before requesting", async () => {
    const { clock } = makeClock();
    const rateLimiter = makeRateLimiter(clock);
    const acquireSpy = vi.spyOn(rateLimiter, "acquire");
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/token")) return Promise.resolve(jsonResponse(tokenBody()));
      return Promise.resolve(jsonResponse({ candles: [], nextBefore: null }));
    });
    const client = createTossInvestClient({ config, rateLimiter, fetchImpl, clock });

    await client.getDailyCandlesPage("005930");
    expect(acquireSpy).toHaveBeenCalledWith("MARKET_DATA_CHART");
  });
});
