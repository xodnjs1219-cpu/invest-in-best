/**
 * 집계 대상 범위 계산 (docs/usecases/029/plan.md 모듈 3).
 * 전부 순수 함수 — "오늘"·"현재 시각"은 항상 인자로 주입한다(worker 029가 유일 호출자).
 */
import { addDays, format } from "date-fns";
import { TIMESERIES_MIN_START_DATE } from "../constants/timeline";
import { TIMESERIES_MIN_CALENDAR_YEAR, TIMESERIES_MIN_CALENDAR_QUARTER } from "../constants/metrics";
import { todayInSeoul } from "./timeline-date";
import { quarterOrdinal, dateToCalendarQuarter } from "./metrics-range";
import type { IsoDate } from "../types/common";

export interface DailyTargetRangeInput {
  /** 직전 성공 실행의 `started_at`(ISO timestamptz) — 없으면 최초 실행(전 기간 캐치업). */
  prevSuccessStartedAt: string | null;
  /** 정정 감지로 발견된 영향 최소 일자들(quote/fx 워터마크) — 없으면 null 포함 가능. */
  correctionMinDates: Array<IsoDate | null>;
  /** 실행 시점 기준 오늘(Asia/Seoul) — 주입. */
  today: IsoDate;
}

export interface DailyTargetRange {
  readonly from: IsoDate;
  readonly to: IsoDate;
}

function clampToMinStart(date: IsoDate): IsoDate {
  return (date < TIMESERIES_MIN_START_DATE ? TIMESERIES_MIN_START_DATE : date) as IsoDate;
}

function subtractOneDay(date: IsoDate): IsoDate {
  return format(addDays(new Date(`${date}T00:00:00Z`), -1), "yyyy-MM-dd") as IsoDate;
}

/**
 * 일별 대상 범위 산출(BR 6.3) — `to`는 항상 전일(최근 확정 일자).
 * `from`은 직전 성공 익일(없으면 시계열 하한)과 정정 최소 일자 중 더 이른 쪽, 하한 2015-01-01로 클램프.
 * `from > to`(당일 재실행 등)면 일별 집계 없음을 뜻하는 `null`을 반환한다.
 */
export function resolveDailyTargetRange(input: DailyTargetRangeInput): DailyTargetRange | null {
  const to = subtractOneDay(input.today);

  const baseFrom: IsoDate = input.prevSuccessStartedAt
    ? (formatIsoDateFromTimestamp(input.prevSuccessStartedAt) as IsoDate)
    : (TIMESERIES_MIN_START_DATE as IsoDate);

  const correctionCandidates = input.correctionMinDates.filter((d): d is IsoDate => d !== null);
  const candidates = [baseFrom, ...correctionCandidates];
  const from = clampToMinStart(candidates.reduce((min, cur) => (cur < min ? cur : min), candidates[0]!));

  if (from > to) return null;
  return { from, to };
}

/**
 * 직전 성공 실행 `started_at`의 KST 일자 — "직전 성공이 집계한 마지막 일자(전일)의 익일"과 동치
 * (실행 시각 자체가 "전일까지 집계 완료" 시점의 다음 날이므로 KST 일자를 그대로 사용한다).
 */
function formatIsoDateFromTimestamp(startedAtIso: string): string {
  return todayInSeoul(new Date(startedAtIso));
}

export interface CalendarQuarterKey {
  readonly year: number;
  readonly quarter: number;
}

export interface TargetQuartersInput {
  /** 재무 정정 감지로 발견된 최소 영향 분기 — 없으면 null. */
  correctionMinQuarter: CalendarQuarterKey | null;
  /** fx 정정 감지로 발견된 최소 영향 일자 — 소속 분기로 환산해 시작 분기 후보에 포함한다. */
  fxCorrectionMinDate: IsoDate | null;
  /** 직전 성공 실행 존재 여부 — false면 최초 실행(전 기간 캐치업, 2015Q1부터). */
  hasPrevSuccess: boolean;
  /** 일별 대상 범위의 `to`(전일) — 종료 분기 산출 기준. */
  to: IsoDate;
}

/**
 * 대상 분기 목록 산출(BR 6.1 역년 축) — 신규 재무 적재·정정으로 영향받은 분기만 연속 목록으로 반환.
 * 시작 후보가 전혀 없으면(정정·신규 없음 + 직전 성공 존재) 분기 집계 자체를 스킵하는 빈 배열을 반환한다.
 */
export function resolveTargetQuarters(input: TargetQuartersInput): CalendarQuarterKey[] {
  const toQuarter = dateToCalendarQuarter(input.to);
  const toOrdinal = quarterOrdinal(toQuarter.calendarYear, toQuarter.calendarQuarter);

  const candidates: CalendarQuarterKey[] = [];
  if (!input.hasPrevSuccess) {
    candidates.push({ year: TIMESERIES_MIN_CALENDAR_YEAR, quarter: TIMESERIES_MIN_CALENDAR_QUARTER });
  }
  if (input.correctionMinQuarter) {
    candidates.push(input.correctionMinQuarter);
  }
  if (input.fxCorrectionMinDate) {
    const q = dateToCalendarQuarter(input.fxCorrectionMinDate);
    candidates.push({ year: q.calendarYear, quarter: q.calendarQuarter });
  }

  if (candidates.length === 0) return [];

  let startOrdinal = Math.min(...candidates.map((c) => quarterOrdinal(c.year, c.quarter)));
  const minOrdinal = quarterOrdinal(TIMESERIES_MIN_CALENDAR_YEAR, TIMESERIES_MIN_CALENDAR_QUARTER);
  if (startOrdinal < minOrdinal) startOrdinal = minOrdinal;

  if (startOrdinal > toOrdinal) return [];

  const result: CalendarQuarterKey[] = [];
  for (let ordinal = startOrdinal; ordinal <= toOrdinal; ordinal += 1) {
    const year = Math.floor(ordinal / 4);
    const quarter = (ordinal % 4) + 1;
    result.push({ year, quarter });
  }
  return result;
}

/** `[from, to]` 폐구간의 모든 일자를 오름차순으로 열거한다. */
export function enumerateDates(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(format(cursor, "yyyy-MM-dd") as IsoDate);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/** `[from, to]`를 `windowDays` 크기로 분할한 연속 창 목록(경계 누락·중복 없음, E13). */
export function splitRangeByWindow(
  from: IsoDate,
  to: IsoDate,
  windowDays: number,
): Array<{ from: IsoDate; to: IsoDate }> {
  const windows: Array<{ from: IsoDate; to: IsoDate }> = [];
  let windowFrom = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (windowFrom <= end) {
    const windowToCandidate = addDays(windowFrom, windowDays - 1);
    const windowTo = windowToCandidate > end ? end : windowToCandidate;
    windows.push({
      from: format(windowFrom, "yyyy-MM-dd") as IsoDate,
      to: format(windowTo, "yyyy-MM-dd") as IsoDate,
    });
    windowFrom = addDays(windowTo, 1);
  }
  return windows;
}

const QUARTER_END_MONTH_DAY: Record<number, string> = {
  1: "03-31",
  2: "06-30",
  3: "09-30",
  4: "12-31",
};

const QUARTER_START_MONTH_DAY: Record<number, string> = {
  1: "01-01",
  2: "04-01",
  3: "07-01",
  4: "10-01",
};

/** 역년 분기의 말일(윤년 포함 — Date 기반이 아닌 고정 매핑이라 2월 29일 문제 없음). */
export function quarterEndDate(year: number, quarter: number): IsoDate {
  return `${year}-${QUARTER_END_MONTH_DAY[quarter]}` as IsoDate;
}

/** 역년 분기의 시작일. */
export function quarterStartDate(year: number, quarter: number): IsoDate {
  return `${year}-${QUARTER_START_MONTH_DAY[quarter]}` as IsoDate;
}
