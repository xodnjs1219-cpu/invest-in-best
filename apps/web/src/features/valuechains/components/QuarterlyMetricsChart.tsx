"use client";

import { dateToCalendarQuarter, type IsoDate } from "@iib/domain";
import { formatKrwCompactOrNull } from "@/lib/formatting/number";
import { CategoryBarChart, type CategoryPoint } from "@/components/charts/CategoryBarChart";
import type { QuarterlyMetricsView } from "@/features/valuechains/context/chain-view-context";

export interface QuarterlyMetricsChartProps {
  view: Extract<QuarterlyMetricsView, { status: "ready" }>;
}

const quarterLabel = (year: number, quarter: number): string => `${year}Q${quarter}`;

/**
 * 분기 지표 차트 (UC-010 plan 모듈 25) — 분기 매출 합계(역년 축·"미제공"·제외 기업 수).
 */
export const QuarterlyMetricsChart = ({ view }: QuarterlyMetricsChartProps) => {
  const data: CategoryPoint[] = view.series.map((point) => ({
    x: quarterLabel(point.calendarYear, point.calendarQuarter),
    y: point.totalRevenueKrw,
    flags: {},
  }));

  const highlightedX = view.highlightedDate
    ? (() => {
        const q = dateToCalendarQuarter(view.highlightedDate as IsoDate);
        return quarterLabel(q.calendarYear, q.calendarQuarter);
      })()
    : null;

  return (
    <CategoryBarChart
      data={data}
      highlightedX={highlightedX}
      nullLabel="미제공"
      yFormatter={(v) => formatKrwCompactOrNull(v, "-")}
      renderTooltip={(point) => {
        const series = view.series.find((s) => quarterLabel(s.calendarYear, s.calendarQuarter) === point.x);
        return (
          <div className="space-y-0.5">
            <p className="font-mono tabular">{point.x}</p>
            <p>{formatKrwCompactOrNull(point.y, "미제공")}</p>
            {series && (
              <p className="text-fg-muted">
                반영 {series.coveredNodeCount} / 전체 {series.totalNodeCount}
                {series.excludedUnmappedCount > 0 && ` · 제외 ${series.excludedUnmappedCount}개`}
              </p>
            )}
            <p className="text-fg-muted">환산 기준: 분기 말일 환율</p>
            {view.annotations.revenueOverlapNotice && (
              <p className="text-fg-muted">매출 중복·비관련 사업부 포함 가능성 있음</p>
            )}
          </div>
        );
      }}
    />
  );
};
