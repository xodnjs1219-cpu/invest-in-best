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
