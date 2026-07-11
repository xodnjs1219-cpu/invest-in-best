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
    className="rounded-sm border border-border-strong bg-surface-sunken px-2 py-1.5 font-mono tabular text-sm text-fg transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  />
);
