/**
 * 시장 상수 (docs/usecases/026/plan.md 모듈 9).
 * DB enum `market_code`('KRX' | 'US') 리터럴과 반드시 일치해야 한다 (0003_securities_master.sql).
 * UC-026(시세 수집)·UC-028(캘린더)·UC-029(집계)가 공유하는 SOT.
 */
export const MARKETS = ["KRX", "US"] as const;

export type MarketCode = (typeof MARKETS)[number];

/** 시장별 IANA 타임존 — 현지 거래일 계산의 단일 기준 (BR-5). */
export const MARKET_TIMEZONES: Record<MarketCode, string> = {
  KRX: "Asia/Seoul",
  US: "America/New_York",
};

/**
 * 환율 통화쌍(docs/usecases/028/plan.md 모듈 1) — `fx_rates` 적재 방향의 단일 SOT.
 * DB enum `currency_code`('KRW'|'USD') 리터럴과 일치. 1 base = rate quote (0009 컬럼 주석).
 */
export const FX_PAIR = { base: "USD", quote: "KRW" } as const;

/**
 * 시장별 표준 정규장 현지 벽시계 시각(docs/usecases/028/plan.md 모듈 1).
 * 조기 마감 판정(calculations/market-calendar.ts)과 캘린더 검증의 기준값.
 */
export const MARKET_REGULAR_SESSION_LOCAL: Record<MarketCode, { open: string; close: string }> = {
  KRX: { open: "09:00", close: "15:30" },
  US: { open: "09:30", close: "16:00" },
};

/**
 * 상장주식수 소스 우선순위(docs/usecases/029/plan.md 모듈 1) — `fn_latest_shares_outstanding`(RPC)의
 * ORDER BY와 일치해야 하는 tie-break 순서. UC-020(`constants/company-detail.ts`)이 이미 정의한
 * `SHARES_SOURCE_PRIORITY`(database.md §3.5)를 재노출한다(SOT 이원화 금지).
 */
export { SHARES_SOURCE_PRIORITY } from "./company-detail";
