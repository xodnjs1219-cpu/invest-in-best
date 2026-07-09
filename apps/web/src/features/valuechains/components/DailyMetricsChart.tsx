"use client";

import { formatKrwCompactOrNull } from "@/lib/formatting/number";
import { TimeSeriesLineChart, type TimeSeriesPoint } from "@/components/charts/TimeSeriesLineChart";
import type { DailyMetricsView } from "@/features/valuechains/context/chain-view-context";

export interface DailyMetricsChartProps {
  view: Extract<DailyMetricsView, { status: "ready" }>;
}

/**
 * 일별 지표 차트 (UC-010 plan 모듈 24) — 가치총액 추이(거래일만·이월/미확정 표기·하이라이트 C-7).
 */
export const DailyMetricsChart = ({ view }: DailyMetricsChartProps) => {
  const data: TimeSeriesPoint[] = view.series.map((point) => ({
    x: point.metricDate,
    y: point.totalMarketCapKrw,
    flags: { isCarriedForward: point.isCarriedForward },
  }));

  return (
    <TimeSeriesLineChart
      data={data}
      highlightedX={view.highlightedDate}
      yFormatter={(v) => formatKrwCompactOrNull(v, "-")}
      renderTooltip={(point) => (
        <div className="space-y-0.5">
          <p className="font-medium">{point.x}</p>
          <p>{formatKrwCompactOrNull(point.y, "지표 미산출")}</p>
          {point.flags?.isCarriedForward && <p className="text-warning">직전 관측값 이월</p>}
          <p className="text-fg-muted">환산 기준: 당일 환율</p>
        </div>
      )}
    />
  );
};
