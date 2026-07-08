"use client";

import type { IsoDate } from "@iib/domain";

export interface TimelineCalendarProps {
  range: { minDate: IsoDate; maxDate: IsoDate };
  selectedDate: IsoDate | null;
  onSelectDate: (date: IsoDate) => void;
}

/**
 * 타임라인 달력 입력 (UC-012 plan 모듈 17) — 범위 밖·미래 날짜는 `min`/`max`로 1차 차단(shadcn-ui
 * calendar가 미설치이므로 네이티브 `<input type="date">`로 대체 구현, 동일 계약 충족).
 */
export const TimelineCalendar = ({ range, selectedDate, onSelectDate }: TimelineCalendarProps) => (
  <input
    type="date"
    aria-label="날짜로 시점 선택"
    min={range.minDate}
    max={range.maxDate}
    value={selectedDate ?? range.maxDate}
    onChange={(e) => {
      const value = e.target.value;
      if (value) {
        onSelectDate(value as IsoDate);
      }
    }}
    className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
  />
);
