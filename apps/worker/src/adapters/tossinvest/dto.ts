/**
 * 토스 외부 DTO 스키마 (docs/usecases/026/plan.md 모듈 12).
 * 외부 응답 Zod 스키마 — 외부 계약과 내부 모델(contract.ts)을 분리한다.
 * 필수 최소 필드만 엄격 검증하고 미지 필드는 passthrough(실 응답 스펙 변경에 방어적).
 */
import { z } from "zod";
import type { NormalizedDailyCandle, NormalizedQuote } from "./contract";

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
