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
 * 타임라인 슬라이더 (UC-012 plan 모듈 17) — 일 단위 슬라이더 + 스냅샷 마커.
 * 드래그 중에는 로컬 상태로만 표시하고, 놓는 시점(onChange 완료, onMouseUp/onTouchEnd)에
 * 1회만 `onSelectDate`를 호출한다(고빈도 이벤트가 Store를 통과하지 않도록).
 * 트랙은 진행분을 accent로 채우고(선택 시점 = 상태 신호), 마커는 트랙 선 위의 점으로 얹는다
 * (영상 플레이어 챕터 마커 관례). 썸 스타일은 globals.css `.mm-slider`가 담당.
 */
export const TimelineSlider = ({ range, markers, selectedDate, onSelectDate }: TimelineSliderProps) => {
  const maxIndex = useMemo(() => toDayIndex(range.maxDate, range.minDate), [range]);
  const [draftIndex, setDraftIndex] = useState<number | null>(null);

  const currentIndex = draftIndex ?? (selectedDate ? toDayIndex(selectedDate, range.minDate) : maxIndex);
  const currentDate = fromDayIndex(currentIndex, range.minDate);
  const fillPct = maxIndex === 0 ? 100 : (currentIndex / maxIndex) * 100;

  const commit = () => {
    if (draftIndex !== null) {
      onSelectDate(fromDayIndex(draftIndex, range.minDate));
      setDraftIndex(null);
    }
  };

  return (
    <div className="space-y-1.5">
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
          className="mm-slider h-2 w-full appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, var(--accent) ${fillPct}%, var(--surface-sunken) ${fillPct}%)`,
          }}
        />
        {/* 스냅샷 마커 — 트랙 선 위의 점(챕터 마커). 선택 시점과 일치하면 accent로 강조. */}
        <div className="pointer-events-none absolute inset-0">
          {markers.map((marker) => {
            const markerDate = marker.effectiveAt.slice(0, 10);
            const idx = toDayIndex(markerDate, range.minDate);
            const pct = maxIndex === 0 ? 0 : (idx / maxIndex) * 100;
            const isSelected = markerDate === currentDate;
            return (
              /* 시각 점(6px)은 ::before로 그리고 버튼 히트 영역은 16×20px로 확장(§8 터치 타깃) */
              <button
                key={marker.snapshotId}
                type="button"
                aria-label={`스냅샷 마커 ${markerDate}`}
                title={markerDate}
                className={`pointer-events-auto absolute top-1/2 h-5 w-4 -translate-x-1/2 -translate-y-1/2 before:absolute before:left-1/2 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:ring-1 before:ring-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected ? "before:bg-accent" : "before:bg-fg-subtle"
                }`}
                style={{ left: `${pct}%` }}
                onClick={() => onSelectDate(markerDate as IsoDate)}
              />
            );
          })}
        </div>
      </div>
      <div className="flex items-baseline justify-between font-mono tabular text-xs">
        <span className="text-fg-subtle">{range.minDate}</span>
        <span data-testid="timeline-slider-current" className="text-fg">
          {currentDate}
        </span>
        <span className="text-fg-subtle">{range.maxDate}</span>
      </div>
    </div>
  );
};
