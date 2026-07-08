import { isValid, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TIMELINE_TIMEZONE, TIMESERIES_MIN_START_DATE } from "../constants/timeline";
import type { IsoDate } from "../types/common";

/**
 * 타임라인 날짜 경계 계산 (UC-012 plan 모듈 2, 결정 C-6).
 * "그 날짜 이전"의 경계(당일 종료 시각 판정)를 단일 원천으로 캡슐화 — UC-010(주석 메타)·
 * UC-012(스냅샷 복원)·worker(029, 당일 유효 구성 판정)가 공유한다.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` 형식 + 실존 날짜(2026-02-30 등 거부) 검증. */
export function isValidIsoDate(raw: string): boolean {
  if (!ISO_DATE_PATTERN.test(raw)) {
    return false;
  }
  const parsed = parseISO(raw);
  if (!isValid(parsed)) {
    return false;
  }
  // parseISO(로컬 타임존 자정 해석)는 2026-02-30 같은 값을 3월로 굴림 처리하므로
  // 로컬 캘린더 필드로 왕복 재검증한다(getUTCDate 사용 시 TZ 오프셋에 따라 하루씩 밀릴 수 있음).
  const [year, month, day] = raw.split("-").map(Number);
  return parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day;
}

/** 주입된 `now`를 Asia/Seoul 기준 날짜 문자열로 변환한다(순수성 유지 — Date.now() 내부 호출 금지). */
export function todayInSeoul(now: Date): IsoDate {
  return formatInTimeZone(now, TIMELINE_TIMEZONE, "yyyy-MM-dd") as IsoDate;
}

/** `D 23:59:59 Asia/Seoul`을 timestamptz ISO 문자열(UTC)로 변환 — 당일 종료 경계(C-6, BR-1·8). */
export function toSeoulDayEndIso(date: IsoDate): string {
  const utcDate = fromZonedTime(`${date}T23:59:59.000`, TIMELINE_TIMEZONE);
  return utcDate.toISOString();
}

/** `[TIMESERIES_MIN_START_DATE, today]` 범위 내 여부(BR-4). */
export function isWithinTimelineRange(date: IsoDate, today: IsoDate): boolean {
  return date >= TIMESERIES_MIN_START_DATE && date <= today;
}
