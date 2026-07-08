/**
 * 토스 외부 DTO 스키마 (docs/usecases/026/plan.md 모듈 12).
 * 외부 응답 Zod 스키마 — 외부 계약과 내부 모델(contract.ts)을 분리한다.
 * 필수 최소 필드만 엄격 검증하고 미지 필드는 passthrough(실 응답 스펙 변경에 방어적).
 */
import { z } from "zod";
import { deriveEarlyClose, resolveFxRateDate, toAbsoluteSessionTime, type MarketCode } from "@iib/domain";
import type {
  NormalizedCalendarDay,
  NormalizedDailyCandle,
  NormalizedFxRate,
  NormalizedQuote,
  NormalizedStockInfo,
} from "./contract";

export const oauthTokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.coerce.number().positive(),
    token_type: z.string().min(1),
  })
  .passthrough();
export type OAuthTokenResponse = z.infer<typeof oauthTokenResponseSchema>;

/** symbol·lastPrice 필수, volume·currency 선택. 숫자는 문자열/숫자 양쪽 수용(z.coerce). */
export const priceItemSchema = z
  .object({
    symbol: z.string().min(1),
    lastPrice: z.coerce.number(),
    volume: z.coerce.number().nullable().optional(),
    currency: z.string().optional(),
  })
  .passthrough();
export type PriceItem = z.infer<typeof priceItemSchema>;

export const pricesResponseSchema = z
  .object({
    prices: z.array(priceItemSchema),
  })
  .passthrough();
export type PricesResponse = z.infer<typeof pricesResponseSchema>;

export const candleSchema = z
  .object({
    timestamp: z.string().min(1),
    openPrice: z.coerce.number(),
    highPrice: z.coerce.number(),
    lowPrice: z.coerce.number(),
    closePrice: z.coerce.number(),
    volume: z.coerce.number().nullable().optional(),
  })
  .passthrough();
export type Candle = z.infer<typeof candleSchema>;

export const candlePageResponseSchema = z
  .object({
    candles: z.array(candleSchema),
    nextBefore: z.string().nullable().optional(),
  })
  .passthrough();
export type CandlePageResponse = z.infer<typeof candlePageResponseSchema>;

/** symbol 필수, sharesOutstanding은 문자열 대형 수 방어(tossinvest-openapi.md §8.1). */
export const stockInfoSchema = z
  .object({
    symbol: z.string().min(1),
    name: z.string().optional(),
    status: z.string().optional(),
    sharesOutstanding: z.coerce.number().nullable().optional(),
  })
  .passthrough();
export type StockInfoItem = z.infer<typeof stockInfoSchema>;

export const stocksResponseSchema = z
  .object({
    stocks: z.array(stockInfoSchema),
  })
  .passthrough();
export type StocksResponse = z.infer<typeof stocksResponseSchema>;

export function toNormalizedStockInfo(item: StockInfoItem): NormalizedStockInfo {
  return {
    symbol: item.symbol,
    sharesOutstanding: item.sharesOutstanding ?? null,
    status: item.status ?? "unknown",
    name: item.name ?? "",
  };
}

/* ── UC-028 collect-fx-market-hours 확장 (docs/usecases/028/plan.md 모듈 4) ── */
/* 필드명은 SOT인 공식 openapi.json 실호출 검증 전 최선의 추정치 — 구현 시 원문 대조로 확정할 항목. */

/** 환율값(양수 강제)·통화쌍 최소 검증. */
export const exchangeRateResponseSchema = z
  .object({
    baseCurrency: z.string().min(1),
    quoteCurrency: z.string().min(1),
    rate: z.coerce.number().positive(),
  })
  .passthrough();
export type ExchangeRateResponse = z.infer<typeof exchangeRateResponseSchema>;

export function toNormalizedFxRate(dto: ExchangeRateResponse, now: Date): NormalizedFxRate {
  return {
    baseCurrency: "USD",
    quoteCurrency: "KRW",
    rate: dto.rate,
    rateDate: resolveFxRateDate(now),
  };
}

/** 정규장 세션 현지 벽시계 시각(HH:mm) — KR/US 캘린더 응답 공통 최소 검증. */
const regularMarketSessionSchema = z
  .object({
    openTime: z.string().min(1),
    closeTime: z.string().min(1),
  })
  .passthrough();

/** 일자·거래일 여부·정규장 개장/폐장 시각 최소 검증. NXT/프리/애프터 세션 필드는 passthrough(저장 안 함). */
const marketCalendarDaySchema = z
  .object({
    date: z.string().min(1),
    isTradingDay: z.boolean(),
    isEarlyClose: z.boolean().optional(),
    regularMarketSession: regularMarketSessionSchema.nullable().optional(),
  })
  .passthrough();

export const krMarketCalendarResponseSchema = z
  .object({
    days: z.array(marketCalendarDaySchema),
  })
  .passthrough();
export type KrMarketCalendarResponse = z.infer<typeof krMarketCalendarResponseSchema>;

export const usMarketCalendarResponseSchema = z
  .object({
    days: z.array(marketCalendarDaySchema),
  })
  .passthrough();
export type UsMarketCalendarResponse = z.infer<typeof usMarketCalendarResponseSchema>;

/**
 * 캘린더 응답(KR/US 공통 형태) → 정규화 모델 배열.
 * 휴장일은 openAt/closeAt을 null로 강제(0009 스키마 규칙). isEarlyClose는 응답 플래그 우선, 부재 시 파생.
 * open>=close 논리 모순은 변환 실패로 분류하고 해당 일자 행을 제외한다(부분 저장 없이 스텝 실패 입력).
 */
export function toNormalizedCalendarDays(
  market: MarketCode,
  dto: KrMarketCalendarResponse | UsMarketCalendarResponse,
): NormalizedCalendarDay[] {
  const results: NormalizedCalendarDay[] = [];

  for (const day of dto.days) {
    if (!day.isTradingDay || !day.regularMarketSession) {
      results.push({
        market,
        calendarDate: day.date,
        isTradingDay: false,
        openAt: null,
        closeAt: null,
        isEarlyClose: false,
      });
      continue;
    }

    const openAt = toAbsoluteSessionTime(market, day.date, day.regularMarketSession.openTime);
    const closeAt = toAbsoluteSessionTime(market, day.date, day.regularMarketSession.closeTime);

    if (openAt.getTime() >= closeAt.getTime()) {
      // 논리 모순(스키마 불일치) — 부분 저장 없이 이 일자만 제외(스텝 실패 판정은 호출측 책임).
      continue;
    }

    const isEarlyClose = day.isEarlyClose ?? deriveEarlyClose(market, day.date, closeAt);

    results.push({
      market,
      calendarDate: day.date,
      isTradingDay: true,
      openAt,
      closeAt,
      isEarlyClose,
    });
  }

  return results;
}

export const tossErrorEnvelopeSchema = z.object({
  error: z
    .object({
      requestId: z.string().optional(),
      code: z.string().min(1),
      message: z.string(),
    })
    .passthrough(),
});
export type TossErrorEnvelope = z.infer<typeof tossErrorEnvelopeSchema>;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function parsePricesResponse(raw: unknown): ParseResult<PricesResponse> {
  const result = pricesResponseSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data };
}

export function parseTossErrorEnvelope(raw: unknown): ParseResult<TossErrorEnvelope> {
  const result = tossErrorEnvelopeSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data };
}

/** DTO → 내부 모델 변환. */
export function toNormalizedQuote(item: PriceItem): NormalizedQuote {
  return {
    symbol: item.symbol,
    price: item.lastPrice,
    volume: item.volume ?? null,
    currency: item.currency ?? "KRW",
  };
}

/** candle DTO → 내부 모델(현지 일자 문자열은 호출부가 계산해 전달 — tz 로직 단일화). */
export function toNormalizedDailyCandle(
  symbol: string,
  candle: Candle,
  localDate: string,
): NormalizedDailyCandle {
  return {
    symbol,
    date: localDate,
    open: candle.openPrice,
    high: candle.highPrice,
    low: candle.lowPrice,
    close: candle.closePrice,
    volume: candle.volume ?? null,
  };
}
