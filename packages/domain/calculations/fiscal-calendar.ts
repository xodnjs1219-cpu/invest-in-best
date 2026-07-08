/**
 * 역년 정규화 계산 (docs/usecases/027/plan.md 모듈 2).
 * 전부 순수 함수 — 결산월이 다른 기업(9월 결산 Apple 등)을 역년 축으로 정렬하기 위한 계산.
 * BR-13·BR-14, E14(스텁 기간 검출). date-fns만 사용(프레임워크·DB 의존성 없음).
 */
import { differenceInCalendarDays } from "date-fns";
import { ANNUAL_PERIOD_DAYS, QUARTER_PERIOD_DAYS } from "../constants/financials";

export interface CalendarPeriod {
  calendarYear: number;
  calendarQuarter: 1 | 2 | 3 | 4 | null;
}

/** 기간의 중앙일(midpoint) — 짝수 일수면 앞쪽 절반 기준(결정적). */
function midpointDate(start: Date, end: Date): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return new Date(startMs + Math.floor((endMs - startMs) / 2));
}

function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/**
 * 기간(start~end)의 중앙일이 속한 역년 분기를 산출한다(BR-14).
 * kind='annual'이면 calendarQuarter는 null(연간 행은 quarter 축 무의미).
 */
export function resolveCalendarPeriod(
  start: string,
  end: string,
  kind: "quarter" | "annual" = "quarter",
): CalendarPeriod {
  const mid = midpointDate(toDate(start), toDate(end));
  const calendarYear = mid.getUTCFullYear();
  if (kind === "annual") {
    return { calendarYear, calendarQuarter: null };
  }
  const month = mid.getUTCMonth(); // 0-11
  const calendarQuarter = (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
  return { calendarYear, calendarQuarter };
}

/** 기간 길이(일) 검증 — quarter/annual 정상 범위(E14, sec-edgar-api.md §8.4). */
export function validatePeriodLength(start: string, end: string, kind: "quarter" | "annual"): boolean {
  const days = differenceInCalendarDays(toDate(end), toDate(start));
  const range = kind === "quarter" ? QUARTER_PERIOD_DAYS : ANNUAL_PERIOD_DAYS;
  return days >= range.min && days <= range.max;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 기간 배열이 겹침·공백 없이 연속(contiguous)인지 검증(BR-13, Q4 파생 전 필수).
 * "연속"은 다음 구간의 시작일이 이전 구간 종료일의 정확히 다음날인 경우만 인정한다
 * (겹침은 물론, 스텁 기간으로 인한 공백도 비연속으로 판정 — E14).
 */
export function arePeriodsContiguous(periods: Array<{ start: string; end: string }>): boolean {
  const sorted = [...periods].sort((a, b) => toDate(a.start).getTime() - toDate(b.start).getTime());
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = toDate(sorted[i - 1]!.end);
    const currStart = toDate(sorted[i]!.start);
    const gapDays = Math.round((currStart.getTime() - prevEnd.getTime()) / MS_PER_DAY);
    if (gapDays !== 1) {
      return false;
    }
  }
  return true;
}
