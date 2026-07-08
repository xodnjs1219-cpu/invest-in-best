import { subYears, subMonths, format } from "date-fns";
import { TIMESERIES_MIN_START_DATE } from "../constants/timeline";
import { TIMESERIES_MIN_CALENDAR_YEAR, TIMESERIES_MIN_CALENDAR_QUARTER } from "../constants/metrics";
import type { IsoDate } from "../types/common";
import type { MetricsRangePreset } from "../constants/timeline";

/**
 * 대시보드 지표 기간 보정·역년 분기 축 계산 (UC-010 plan 모듈 2, 결정 C-5·C-8, spec E8·E11).
 * 순수 함수 — "오늘"은 항상 인자로 주입한다(web BE/FE + worker 029 공유).
 */

export type CalendarQuarter = { readonly calendarYear: number; readonly calendarQuarter: 1 | 2 | 3 | 4 };

/** 프리셋별 시작일 산출 — `MAX`는 시계열 하한부터(E8). */
export function presetToDailyRange(
  preset: MetricsRangePreset,
  today: IsoDate,
): { from: IsoDate; to: IsoDate } {
  const todayDate = new Date(`${today}T00:00:00Z`);
  let fromDate: Date;
  switch (preset) {
    case "1M":
      fromDate = subMonths(todayDate, 1);
      break;
    case "3M":
      fromDate = subMonths(todayDate, 3);
      break;
    case "6M":
      fromDate = subMonths(todayDate, 6);
      break;
    case "1Y":
      fromDate = subYears(todayDate, 1);
      break;
    case "3Y":
      fromDate = subYears(todayDate, 3);
      break;
    case "MAX":
      return { from: TIMESERIES_MIN_START_DATE as IsoDate, to: today };
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
  const from = format(fromDate, "yyyy-MM-dd");
  return {
    from: (from < TIMESERIES_MIN_START_DATE ? TIMESERIES_MIN_START_DATE : from) as IsoDate,
    to: today,
  };
}

export type DailyRangeResolution =
  | { ok: true; from: IsoDate; to: IsoDate; at: IsoDate | null }
  | { ok: false; reason: "FROM_AFTER_TO" | "AT_OUT_OF_RANGE" };

/** 일별 지표 API 파라미터 해석 — 기본값(C-5)·하한/상한 보정(E8·E11). */
export function resolveDailyMetricsRange(input: {
  from?: string;
  to?: string;
  at?: string;
  today: IsoDate;
}): DailyRangeResolution {
  const { today } = input;

  let from = input.from ?? presetToDailyRange("1Y", today).from;
  let to = input.to ?? today;

  if (from < TIMESERIES_MIN_START_DATE) {
    from = TIMESERIES_MIN_START_DATE;
  }
  if (to > today) {
    to = today;
  }

  if (from > to) {
    return { ok: false, reason: "FROM_AFTER_TO" };
  }

  if (input.at !== undefined) {
    if (input.at < TIMESERIES_MIN_START_DATE || input.at > today) {
      return { ok: false, reason: "AT_OUT_OF_RANGE" };
    }
  }

  return { ok: true, from: from as IsoDate, to: to as IsoDate, at: (input.at as IsoDate) ?? null };
}

/** D가 속한 역년 정규화 분기 산출(회계연도 아님 — 역년 축, worker 029와 공유 단일 정의). */
export function dateToCalendarQuarter(date: IsoDate): CalendarQuarter {
  const month = Number(date.slice(5, 7));
  const calendarYear = Number(date.slice(0, 4));
  const calendarQuarter = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  return { calendarYear, calendarQuarter };
}

/** (year, quarter) 비교용 정렬 키. */
export function quarterOrdinal(year: number, quarter: number): number {
  return year * 4 + (quarter - 1);
}

export type QuarterlyRangeResolution =
  | {
      ok: true;
      from: { year: number; quarter: number };
      to: { year: number; quarter: number };
      atQuarter: CalendarQuarter | null;
    }
  | { ok: false; reason: "FROM_AFTER_TO" | "INVALID_PAIR" };

/** 분기 지표 API 파라미터 해석 — 기본값(최근 1년=직전 4개 분기+오늘 분기, C-5), 하한 2015Q1(E8). */
export function resolveQuarterlyMetricsRange(input: {
  fromYear?: number;
  fromQuarter?: number;
  toYear?: number;
  toQuarter?: number;
  at?: string;
  today: IsoDate;
}): QuarterlyRangeResolution {
  const { today } = input;
  const todayQuarter = dateToCalendarQuarter(today);

  const fromPairGiven = input.fromYear !== undefined || input.fromQuarter !== undefined;
  const toPairGiven = input.toYear !== undefined || input.toQuarter !== undefined;
  if (fromPairGiven && (input.fromYear === undefined || input.fromQuarter === undefined)) {
    return { ok: false, reason: "INVALID_PAIR" };
  }
  if (toPairGiven && (input.toYear === undefined || input.toQuarter === undefined)) {
    return { ok: false, reason: "INVALID_PAIR" };
  }

  let from = fromPairGiven
    ? { year: input.fromYear as number, quarter: input.fromQuarter as number }
    : (() => {
        // 기본값: 오늘 분기 포함 최근 5개 분기(직전 4개 분기 + 오늘 분기, C-5) — dateToCalendarQuarter 하나로 계산.
        const base = subMonths(new Date(`${today}T00:00:00Z`), 12);
        const q = dateToCalendarQuarter(format(base, "yyyy-MM-dd") as IsoDate);
        return { year: q.calendarYear, quarter: q.calendarQuarter };
      })();
  let to = toPairGiven
    ? { year: input.toYear as number, quarter: input.toQuarter as number }
    : { year: todayQuarter.calendarYear, quarter: todayQuarter.calendarQuarter };

  // 하한 클램프(E8)
  if (quarterOrdinal(from.year, from.quarter) < quarterOrdinal(TIMESERIES_MIN_CALENDAR_YEAR, TIMESERIES_MIN_CALENDAR_QUARTER)) {
    from = { year: TIMESERIES_MIN_CALENDAR_YEAR, quarter: TIMESERIES_MIN_CALENDAR_QUARTER };
  }
  // 상한 보정(미래 분기 → 오늘 분기)
  if (quarterOrdinal(to.year, to.quarter) > quarterOrdinal(todayQuarter.calendarYear, todayQuarter.calendarQuarter)) {
    to = { year: todayQuarter.calendarYear, quarter: todayQuarter.calendarQuarter };
  }

  if (quarterOrdinal(from.year, from.quarter) > quarterOrdinal(to.year, to.quarter)) {
    return { ok: false, reason: "FROM_AFTER_TO" };
  }

  let atQuarter: CalendarQuarter | null = null;
  if (input.at !== undefined) {
    atQuarter = dateToCalendarQuarter(input.at as IsoDate);
  }

  return { ok: true, from, to, atQuarter };
}
