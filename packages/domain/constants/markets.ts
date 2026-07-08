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
