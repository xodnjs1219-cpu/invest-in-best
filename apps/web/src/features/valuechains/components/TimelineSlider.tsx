"use client";

import { useMemo, useState } from "react";
import type { IsoDate } from "@iib/domain";
import type { SnapshotMarkerView } from "@/features/valuechains/context/chain-view-context";

export interface TimelineSliderProps {
  range: { minDate: IsoDate; maxDate: IsoDate };
  markers: readonly SnapshotMarkerView[];
  selectedDate: IsoDate | null;
  onSelectDate: (date: IsoDate) => void;
}

const toDayIndex = (date: string, minDate: string): number => {
  const diffMs = new Date(`${date}T00:00:00Z`).getTime() - new Date(`${minDate}T00:00:00Z`).getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
};

const fromDayIndex = (index: number, minDate: string): IsoDate => {
  const date = new Date(`${minDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10) as IsoDate;
};

/**
 * 타임라인 슬라이더 (UC-012 plan 모듈 17) — 일 단위 슬라이더 + 마커 오버레이.
 * 드래그 중에는 로컬 상태로만 표시하고, 놓는 시점(onChange 완료, onMouseUp/onTouchEnd)에
 * 1회만 `onSelectDate`를 호출한다(고빈도 이벤트가 Store를 통과하지 않도록).
 */
export const TimelineSlider = ({ range, markers, selectedDate, onSelectDate }: TimelineSliderProps) => {
  const maxIndex = useMemo(() => toDayIndex(range.maxDate, range.minDate), [range]);
  const [draftIndex, setDraftIndex] = useState<number | null>(null);

  const currentIndex = draftIndex ?? (selectedDate ? toDayIndex(selectedDate, range.minDate) : maxIndex);
  const currentDate = fromDayIndex(currentIndex, range.minDate);

  const commit = () => {
    if (draftIndex !== null) {
      onSelectDate(fromDayIndex(draftIndex, range.minDate));
      setDraftIndex(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={currentIndex}
          onChange={(e) => setDraftIndex(Number(e.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          aria-label="타임라인 날짜 선택"
          className="h-2 w-full appearance-none rounded-full bg-surface-sunken accent-accent"
        />
        <div className="pointer-events-none absolute inset-x-0 top-4 h-2">
          {markers.map((marker) => {
            const markerDate = marker.effectiveAt.slice(0, 10);
            const idx = toDayIndex(markerDate, range.minDate);
            const pct = maxIndex === 0 ? 0 : (idx / maxIndex) * 100;
            return (
              <button
                key={marker.snapshotId}
                type="button"
                aria-label={`스냅샷 마커 ${markerDate}`}
                className="pointer-events-auto absolute h-2 w-1 -translate-x-1/2 rounded-[var(--radius-sm)] bg-fg-muted"
                style={{ left: `${pct}%` }}
                onClick={() => onSelectDate(markerDate as IsoDate)}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between font-mono tabular text-xs text-fg-muted">
        <span>{range.minDate}</span>
        <span data-testid="timeline-slider-current">{currentDate}</span>
        <span>{range.maxDate}</span>
      </div>
    </div>
  );
};
