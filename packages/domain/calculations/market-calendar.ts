/**
 * 캘린더 계산 (docs/usecases/028/plan.md 모듈 2).
 * 전부 순수 함수 — 026의 market-session.ts와 별개 파일(심볼 충돌 없음).
 * 현지 벽시계 시각 → 절대 시각(timestamptz) 변환(DST 자연 반영), 조기 마감 판정, 환율 기준일(KST) 산출.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { MARKET_REGULAR_SESSION_LOCAL, MARKET_TIMEZONES, type MarketCode } from "../constants/markets";

/**
 * 시장 타임존 기준 현지 벽시계 시각(localDate + localTime) → 절대 시각(UTC Date).
 * DST는 시간대 규칙으로 자연 반영된다(spec BR-4).
 */
export function toAbsoluteSessionTime(market: MarketCode, localDate: string, localTime: string): Date {
  const timeZone = MARKET_TIMEZONES[market];
  return fromZonedTime(`${localDate}T${localTime}:00`, timeZone);
}

/**
 * 응답이 명시적 조기 마감 플래그를 제공하지 않을 때의 파생 규칙(spec Main 7).
 * 실제 마감 시각이 표준 정규장 마감보다 이르면 조기 마감으로 판정한다.
 */
export function deriveEarlyClose(market: MarketCode, localDate: string, closeAt: Date): boolean {
  const regularCloseAt = toAbsoluteSessionTime(market, localDate, MARKET_REGULAR_SESSION_LOCAL[market].close);
  return closeAt.getTime() < regularCloseAt.getTime();
}

/**
 * `fx_rates.rate_date`(수집 기준일)의 단일 SOT — Asia/Seoul 기준 yyyy-MM-dd.
 * 기준 통화 표시가 KRW(국내 고시 환율)이므로 KST 일자를 사용한다.
 */
export function resolveFxRateDate(now: Date): string {
  return formatInTimeZone(now, "Asia/Seoul", "yyyy-MM-dd");
}
