"use client";

import { useId, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TimeSeriesPoint {
  x: string;
  y: number | null;
  flags?: Record<string, boolean>;
}

export interface TimeSeriesLineChartProps {
  data: readonly TimeSeriesPoint[];
  highlightedX?: string | null;
  renderTooltip?: (point: TimeSeriesPoint) => ReactNode;
  yFormatter?: (value: number) => string;
  height?: number;
}

/**
 * 시계열 라인차트 프레젠테이션 래퍼(UC-010 plan 모듈 20) — recharts 기반, 도메인 지식 없음.
 * x축은 카테고리형(전달된 포인트만 나열 — "거래일만 표시" 규칙의 구현 지점). `y: null` 포인트는
 * 라인을 단절해 미산출 구간을 시각적으로 구분한다(connectNulls: false).
 */
export const TimeSeriesLineChart = ({
  data,
  highlightedX = null,
  renderTooltip,
  yFormatter,
  height = 240,
}: TimeSeriesLineChartProps) => {
  const gradientId = useId();
  const highlighted = highlightedX ? data.find((p) => p.x === highlightedX) : undefined;

  return (
    <div className="viz-root" style={{ width: "100%", height }}>
      <style>{`
        .viz-root {
          --surface-1: #fcfcfb;
          --text-secondary: #52514e;
          --grid-line: #e5e4e0;
          --series-1: #2a78d6;
        }
        @media (prefers-color-scheme: dark) {
          .viz-root {
            --surface-1: #1a1a19;
            --text-secondary: #c3c2b7;
            --grid-line: #33322e;
            --series-1: #3987e5;
          }
        }
        :root[data-theme="dark"] .viz-root {
          --surface-1: #1a1a19;
          --text-secondary: #c3c2b7;
          --grid-line: #33322e;
          --series-1: #3987e5;
        }
        :root[data-theme="light"] .viz-root {
          --surface-1: #fcfcfb;
          --text-secondary: #52514e;
          --grid-line: #e5e4e0;
          --series-1: #2a78d6;
        }
      `}</style>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data as TimeSeriesPoint[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid-line)" vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--grid-line)" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={yFormatter}
            width={64}
          />
          {renderTooltip && (
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) {
                  return null;
                }
                const point = payload[0]?.payload as TimeSeriesPoint;
                return (
                  <div className="rounded border border-[var(--grid-line)] bg-[var(--surface-1)] px-3 py-2 text-xs shadow-sm">
                    {renderTooltip(point)}
                  </div>
                );
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="y"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            id={gradientId}
          />
          {highlighted && highlighted.y !== null && (
            <ReferenceDot
              x={highlighted.x}
              y={highlighted.y}
              r={5}
              fill="var(--series-1)"
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
