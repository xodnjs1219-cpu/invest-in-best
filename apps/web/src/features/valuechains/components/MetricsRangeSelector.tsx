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
    <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700" role="group" aria-label="지표 조회 기간">
      {METRICS_RANGE_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange({ kind: "preset", preset })}
          aria-pressed={activePreset === preset}
          className={`px-3 py-1.5 text-xs font-medium first:rounded-l-md last:rounded-r-md ${
            activePreset === preset
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
  );
};
