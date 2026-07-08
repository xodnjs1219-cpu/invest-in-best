/**
 * 시장 세션 계산 (docs/usecases/026/plan.md 모듈 10).
 * 전부 순수 함수 — UC-026(개장 판정·정시 정규화), UC-028(캘린더 검증), UC-029(집계 기준일)와 공유.
 * 개장 판정은 market_calendar의 절대 시각(timestamptz) 비교라 조기 마감·DST가 자동 반영된다 (E2, BR-2).
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays } from "date-fns";
import { MARKET_TIMEZONES, type MarketCode } from "../constants/markets";

export type MarketPhase = "unknown" | "holiday" | "before_open" | "open" | "after_close";

export interface MarketCalendarSession {
  isTradingDay: boolean;
  openAt: Date | null;
  closeAt: Date | null;
}

/** 시장 타임존 기준 현지 일자(yyyy-MM-dd) — 캘린더 조회·trade_date 산출의 단일 SOT. */
export function resolveLocalDate(market: MarketCode, at: Date): string {
  return formatInTimeZone(at, MARKET_TIMEZONES[market], "yyyy-MM-dd");
}

/** 캘린더 행과 현재 시각으로 시장 단계 판정. 행이 없으면 'unknown'(E9 보수적 스킵 입력). */
export function resolveMarketPhase(
  calendar: MarketCalendarSession | null,
  now: Date,
): MarketPhase {
  if (calendar === null) return "unknown";
  if (!calendar.isTradingDay || calendar.openAt === null || calendar.closeAt === null) {
    return "holiday";
  }
  if (now.getTime() < calendar.openAt.getTime()) return "before_open";
  if (now.getTime() < calendar.closeAt.getTime()) return "open";
  return "after_close";
}

/** observed_at 정시 정규화 (BR-6·E8) — 분/초/밀리초 절삭, 멱등. */
export function normalizeToHourUtc(now: Date): Date {
  const normalized = new Date(now.getTime());
  normalized.setUTCMinutes(0, 0, 0);
  return normalized;
}

/** 현지 일자의 [00:00, 익일 00:00) UTC 절대 구간 — 잠정 집계 RPC의 틱 범위 파라미터. */
export function localDayUtcRange(
  market: MarketCode,
  localDate: string,
): { fromUtc: Date; toUtc: Date } {
  const timeZone = MARKET_TIMEZONES[market];
  const fromUtc = fromZonedTime(`${localDate}T00:00:00`, timeZone);
  const nextLocalDate = formatInTimeZone(addDays(fromUtc, 1), timeZone, "yyyy-MM-dd");
  const toUtc = fromZonedTime(`${nextLocalDate}T00:00:00`, timeZone);
  return { fromUtc, toUtc };
}
