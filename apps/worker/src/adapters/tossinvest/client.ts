/**
 * 토스 어댑터 구현 (docs/usecases/026/plan.md 모듈 13).
 * 【외부 서비스 연동 모듈 — 토스증권 Open API】
 * 토큰 관리·청크 분할·레이트리밋·재시도·오류 코드 매핑·Zod 검증을 이 파일에 격리한다.
 * 잡은 contract.ts(TossInvestPort)에만 의존한다.
 */
import { MARKET_TIMEZONES, TOSS_SYMBOLS_CHUNK_SIZE, type MarketCode } from "@iib/domain";
import { formatInTimeZone } from "date-fns-tz";
import type { WorkerConfig } from "../../runtime/config";
import type { RateLimiter } from "../../runtime/rate-limiter";
import { withRetry, type RetryOptions } from "../../runtime/retry";
import {
  TossAuthError,
  TossRequestError,
  type GetPricesResult,
  type NormalizedDailyCandle,
  type SymbolFailure,
  type TossInvestPort,
} from "./contract";
import {
  candlePageResponseSchema,
  oauthTokenResponseSchema,
  parseTossErrorEnvelope,
  priceItemSchema,
  toNormalizedDailyCandle,
  toNormalizedQuote,
} from "./dto";

const BASE_URL = "https://openapi.tossinvest.com";

/** 토큰 만료 이 시간(ms) 전부터 선제 재발급한다. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export interface TossInvestClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const defaultClock: TossInvestClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface CreateTossInvestClientOptions {
  config: WorkerConfig;
  rateLimiter: RateLimiter;
  fetchImpl?: typeof fetch;
  clock?: TossInvestClock;
  retryOptions?: Partial<RetryOptions>;
}

interface TokenState {
  accessToken: string;
  expiresAtMs: number;
}

/** 재시도 대상 판정: 429·5xx·네트워크 오류. stock-not-found(404)는 재시도 무의미. */
function shouldRetryTossError(error: unknown): boolean {
  if (error instanceof TossRequestError) {
    return error.status === 429 || error.status >= 500;
  }
  // 네트워크/타임아웃 등 알 수 없는 오류는 재시도 대상으로 간주.
  return !(error instanceof TossAuthError);
}

export function createTossInvestClient(options: CreateTossInvestClientOptions): TossInvestPort {
  const { config, rateLimiter } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const clock = options.clock ?? defaultClock;
  const retryOptions: RetryOptions = {
    sleep: clock.sleep.bind(clock),
    ...options.retryOptions,
  };

  let tokenState: TokenState | null = null;
  let tokenRefreshPromise: Promise<TokenState> | null = null;

  async function fetchNewToken(): Promise<TokenState> {
    await rateLimiter.acquire("AUTH");
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.tossClientId,
      client_secret: config.tossClientSecret,
    });
    const response = await fetchImpl(`${BASE_URL}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) {
      const message = await extractErrorMessage(response);
      throw new TossAuthError(`토큰 발급 실패: ${message}`);
    }
    const raw: unknown = await response.json();
    const parsed = oauthTokenResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new TossAuthError(`토큰 응답 검증 실패: ${parsed.error.message}`);
    }
    return {
      accessToken: parsed.data.access_token,
      expiresAtMs: clock.now() + parsed.data.expires_in * 1_000,
    };
  }

  /** 동시 재발급 방지: 진행 중인 재발급 Promise를 공유한다. */
  async function refreshToken(): Promise<TokenState> {
    if (tokenRefreshPromise === null) {
      tokenRefreshPromise = fetchNewToken()
        .then((state) => {
          tokenState = state;
          return state;
        })
        .catch((error) => {
          if (error instanceof TossAuthError) throw error;
          throw new TossAuthError(`토큰 재발급 실패: ${(error as Error).message}`);
        })
        .finally(() => {
          tokenRefreshPromise = null;
        });
    }
    return tokenRefreshPromise;
  }

  async function getAccessToken(): Promise<string> {
    if (tokenState !== null && clock.now() < tokenState.expiresAtMs - TOKEN_REFRESH_MARGIN_MS) {
      return tokenState.accessToken;
    }
    const state = await refreshToken();
    return state.accessToken;
  }

  /** 인증 헤더를 붙여 요청하고, 401(만료/무효 토큰) 수신 시 1회 재발급 후 재시도한다. */
  async function authorizedFetch(
    path: string,
    init: RequestInit,
    rateLimitGroup: string,
  ): Promise<Response> {
    await rateLimiter.acquire(rateLimitGroup);
    const token = await getAccessToken();
    let response = await fetchImpl(`${BASE_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      const envelope = await tryParseErrorEnvelope(response);
      if (envelope?.error.code === "expired-token" || envelope?.error.code === "invalid-token") {
        const state = await refreshToken(); // 캐시 무효화 + 재발급(실패 시 TossAuthError throw)
        response = await fetchImpl(`${BASE_URL}${path}`, {
          ...init,
          headers: { ...init.headers, Authorization: `Bearer ${state.accessToken}` },
        });
      }
    }

    feedbackRateLimitHeaders(rateLimiter, rateLimitGroup, response);
    return response;
  }

  return {
    async getPrices(symbols: string[]): Promise<GetPricesResult> {
      const chunks = chunk(symbols, TOSS_SYMBOLS_CHUNK_SIZE);
      const quotes: GetPricesResult["quotes"] = [];
      const failures: SymbolFailure[] = [];
      const carriedOverSymbols: string[] = [];

      for (const chunkSymbols of chunks) {
        try {
          const response = await withRetry(
            () => requestPricesChunk(chunkSymbols),
            { ...retryOptions, shouldRetry: shouldRetryTossError },
          );
          const requestedSet = new Set(chunkSymbols);
          const seenSet = new Set<string>();

          for (const item of response.prices) {
            const validated = priceItemSchema.safeParse(item);
            const symbol = typeof (item as { symbol?: unknown }).symbol === "string"
              ? (item as { symbol: string }).symbol
              : "unknown";
            if (!validated.success) {
              failures.push({
                symbol,
                reason: "validation_failed",
                message: validated.error.message,
              });
              seenSet.add(symbol);
              continue;
            }
            seenSet.add(validated.data.symbol);
            quotes.push(toNormalizedQuote(validated.data));
          }

          for (const requested of requestedSet) {
            if (!seenSet.has(requested)) {
              failures.push({ symbol: requested, reason: "not_found", message: "response missing symbol" });
            }
          }
        } catch (error) {
          if (error instanceof TossAuthError) throw error;
          carriedOverSymbols.push(...chunkSymbols);
        }
      }

      return { quotes, failures, carriedOverSymbols };
    },

    async getConfirmedDailyCandle(
      symbol: string,
      localDate: string,
      market: MarketCode,
    ): Promise<NormalizedDailyCandle | null> {
      return withRetry(
        () => requestConfirmedDailyCandle(symbol, localDate, market),
        { ...retryOptions, shouldRetry: shouldRetryTossError },
      );
    },
  };

  async function requestPricesChunk(symbols: string[]): Promise<{ prices: unknown[] }> {
    const params = new URLSearchParams({ symbols: symbols.join(",") });
    const response = await authorizedFetch(
      `/api/v1/prices?${params.toString()}`,
      { method: "GET" },
      "MARKET_DATA",
    );
    if (!response.ok) {
      throw await toTossRequestError(response);
    }
    const raw = (await response.json()) as { prices?: unknown[] };
    return { prices: Array.isArray(raw.prices) ? raw.prices : [] };
  }

  async function requestConfirmedDailyCandle(
    symbol: string,
    localDate: string,
    market: MarketCode,
  ): Promise<NormalizedDailyCandle | null> {
    const params = new URLSearchParams({
      symbol,
      interval: "1d",
      count: "1",
      adjusted: "true",
    });
    const response = await authorizedFetch(
      `/api/v1/candles?${params.toString()}`,
      { method: "GET" },
      "MARKET_DATA_CHART",
    );
    if (!response.ok) {
      throw await toTossRequestError(response);
    }
    const raw: unknown = await response.json();
    const parsed = candlePageResponseSchema.safeParse(raw);
    if (!parsed.success || parsed.data.candles.length === 0) {
      return null;
    }
    const latest = parsed.data.candles[0]!;
    const candleLocalDate = formatInTimeZone(
      new Date(latest.timestamp),
      MARKET_TIMEZONES[market],
      "yyyy-MM-dd",
    );
    if (candleLocalDate !== localDate) {
      return null; // 아직 당일 봉 미발행(E10) — 오류 아님
    }
    return toNormalizedDailyCandle(symbol, latest, localDate);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function feedbackRateLimitHeaders(rateLimiter: RateLimiter, group: string, response: Response): void {
  const limitHeader = response.headers.get("X-RateLimit-Limit");
  const remainingHeader = response.headers.get("X-RateLimit-Remaining");
  const resetHeader = response.headers.get("X-RateLimit-Reset");
  const feedback: { limit?: number; remaining?: number; reset?: number } = {};
  if (limitHeader !== null) feedback.limit = Number(limitHeader);
  if (remainingHeader !== null) feedback.remaining = Number(remainingHeader);
  if (resetHeader !== null) feedback.reset = Number(resetHeader);
  if (Object.keys(feedback).length > 0) {
    rateLimiter.feedback(group, feedback);
  }
}

async function tryParseErrorEnvelope(response: Response): Promise<{ error: { code: string; message: string } } | null> {
  try {
    const clone = response.clone();
    const raw: unknown = await clone.json();
    const parsed = parseTossErrorEnvelope(raw);
    return parsed.ok ? parsed.data : null;
  } catch {
    return null;
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  const envelope = await tryParseErrorEnvelope(response);
  return envelope?.error.message ?? `HTTP ${response.status}`;
}

/** HTTP 오류 응답을 TossRequestError로 변환. 429는 Retry-After를 retryAfterMs로 노출한다(E3). */
async function toTossRequestError(response: Response): Promise<TossRequestError> {
  const envelope = await tryParseErrorEnvelope(response);
  const code = envelope?.error.code ?? "unknown-error";
  const message = envelope?.error.message ?? `HTTP ${response.status}`;
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterMs =
    retryAfterHeader !== null && !Number.isNaN(Number(retryAfterHeader))
      ? Number(retryAfterHeader) * 1_000
      : undefined;
  return new TossRequestError({ code, status: response.status, message, retryAfterMs });
}
