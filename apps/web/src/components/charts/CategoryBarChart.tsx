"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface CategoryPoint {
  x: string;
  y: number | null;
  flags?: Record<string, boolean>;
}

export interface CategoryBarChartProps {
  data: readonly CategoryPoint[];
  highlightedX?: string | null;
  renderTooltip?: (point: CategoryPoint) => ReactNode;
  yFormatter?: (value: number) => string;
  nullLabel?: string;
  height?: number;
}

/**
 * 카테고리 막대차트 프레젠테이션 래퍼(UC-010 plan 모듈 20) — recharts 기반, 분기 축·null 구간 표시.
 * `y: null`은 막대를 그리지 않고(0으로 표시하지 않음) 커스텀 라벨(nullLabel)로 "미제공"을 안내한다.
 */
export const CategoryBarChart = ({
  data,
  highlightedX = null,
  renderTooltip,
  yFormatter,
  nullLabel = "미제공",
  height = 240,
}: CategoryBarChartProps) => {
  return (
    <div className="viz-root" style={{ width: "100%", height }}>
      <style>{`
        .viz-root {
          --surface-1: #fcfcfb;
          --text-secondary: #52514e;
          --grid-line: #e5e4e0;
          --series-1: #2a78d6;
          --series-1-highlight: #184f95;
        }
        :root[data-theme="dark"] .viz-root {
          --surface-1: #1a1a19;
          --text-secondary: #c3c2b7;
          --grid-line: #33322e;
          --series-1: #3987e5;
          --series-1-highlight: #86b6ef;
        }
        @media (prefers-color-scheme: dark) {
          .viz-root {
            --surface-1: #1a1a19;
            --text-secondary: #c3c2b7;
            --grid-line: #33322e;
            --series-1: #3987e5;
            --series-1-highlight: #86b6ef;
          }
        }
      `}</style>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data as CategoryPoint[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid-line)" vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--grid-line)" }}
            tickLine={false}
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
                const point = payload[0]?.payload as CategoryPoint;
                if (point.y === null) {
                  return (
                    <div className="rounded border border-[var(--grid-line)] bg-[var(--surface-1)] px-3 py-2 text-xs shadow-sm">
                      {point.x}: {nullLabel}
                    </div>
                  );
                }
                return (
                  <div className="rounded border border-[var(--grid-line)] bg-[var(--surface-1)] px-3 py-2 text-xs shadow-sm">
                    {renderTooltip(point)}
                  </div>
                );
              }}
            />
          )}
          <Bar
            dataKey="y"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            shape={(props: unknown) => {
              const p = props as { payload: CategoryPoint; x: number; y: number; width: number; height: number };
              if (p.payload.y === null) {
                return <g />;
              }
              const isHighlighted = p.payload.x === highlightedX;
              return (
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.width}
                  height={p.height}
                  rx={4}
                  fill={isHighlighted ? "var(--series-1-highlight)" : "var(--series-1)"}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
