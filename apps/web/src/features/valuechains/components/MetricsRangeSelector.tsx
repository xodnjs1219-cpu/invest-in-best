"use client";

import { METRICS_RANGE_PRESETS, type MetricsRangePreset } from "@iib/domain";
import type { MetricsRange } from "@/features/valuechains/state/chain-view.reducer";

export interface MetricsRangeSelectorProps {
  range: MetricsRange;
  onChange: (range: MetricsRange) => void;
}

/**
 * 기간 선택기 (UC-010 plan 모듈 23) — 1M/3M/6M/1Y/3Y/MAX 프리셋 버튼 그룹.
 * 커스텀 범위 입력은 향후 확장 지점(현재는 프리셋만 — MVP 범위, PRD 우선순위에 따라 축소).
 */
export const MetricsRangeSelector = ({ range, onChange }: MetricsRangeSelectorProps) => {
  const activePreset: MetricsRangePreset | null = range.kind === "preset" ? range.preset : null;

  return (
    <div className="inline-flex gap-1" role="group" aria-label="지표 조회 기간">
      {METRICS_RANGE_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange({ kind: "preset", preset })}
          aria-pressed={activePreset === preset}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            activePreset === preset
              ? "bg-accent text-accent-fg"
              : "bg-surface-sunken text-fg-muted hover:bg-surface-hover"
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
  );
};
