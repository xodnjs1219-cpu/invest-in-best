"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface CategoryPoint {
  x: string;
  y: number | null;
  flags?: Record<string, boolean>;
}

/** 다중 시리즈 포인트(UC-020 plan 모듈 10 확장) — `values`에 시리즈 key별 값을 담는다. */
export interface CategorySeriesPoint {
  x: string;
  values: Record<string, number | null>;
  flags?: Record<string, boolean>;
}

export interface CategorySeriesDefinition {
  key: string;
  label: string;
}

const SERIES_COLORS = ["#2a78d6", "#1a7f4b", "#c0392b", "#8e6fce"] as const;

export interface CategoryBarChartProps {
  /** 단일 시리즈(기존 계약, UC-010) 또는 다중 시리즈(UC-020 확장) — series 지정 시 data는 CategorySeriesPoint[]. */
  data: readonly CategoryPoint[] | readonly CategorySeriesPoint[];
  /** 다중 시리즈 정의 — 미지정 시 기존 단일 y 동작(하위호환). */
  series?: readonly CategorySeriesDefinition[];
  highlightedX?: string | null;
  renderTooltip?: (point: CategoryPoint) => ReactNode;
  yFormatter?: (value: number) => string;
  nullLabel?: string;
  height?: number;
}

const isMultiSeries = (
  data: CategoryBarChartProps["data"],
  series: CategoryBarChartProps["series"],
): data is readonly CategorySeriesPoint[] => Boolean(series && series.length > 0);

/**
 * 카테고리 막대차트 프레젠테이션 래퍼(UC-010 plan 모듈 20, UC-020 plan 모듈 10에서 다중 시리즈 확장) —
 * recharts 기반, 분기 축·null 구간 표시. `y`/시리즈 값이 `null`이면 막대를 그리지 않고(0으로 표시하지 않음)
 * 커스텀 라벨(nullLabel)로 "미제공"을 안내한다. `series` 미지정 시 기존 단일 시리즈 동작 그대로(하위호환).
 */
export const CategoryBarChart = ({
  data,
  series,
  highlightedX = null,
  renderTooltip,
  yFormatter,
  nullLabel = "미제공",
  height = 240,
}: CategoryBarChartProps) => {
  const multiSeries = isMultiSeries(data, series);

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
        <BarChart
          data={
            multiSeries
              ? (data as readonly CategorySeriesPoint[]).map((point) => ({
                  x: point.x,
                  ...point.values,
                }))
              : (data as CategoryPoint[])
          }
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
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
          {multiSeries && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {!multiSeries && renderTooltip && (
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
          {multiSeries && (
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) {
                  return null;
                }
                return (
                  <div className="rounded border border-[var(--grid-line)] bg-[var(--surface-1)] px-3 py-2 text-xs shadow-sm">
                    <div className="mb-1 font-medium">{label}</div>
                    {(series ?? []).map((s) => {
                      const entry = payload.find((p) => p.dataKey === s.key);
                      const value = entry?.value as number | null | undefined;
                      return (
                        <div key={s.key}>
                          {s.label}: {value === null || value === undefined ? nullLabel : (yFormatter ? yFormatter(value) : value)}
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
          )}
          {multiSeries
            ? (series ?? []).map((s, index) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))
            : (
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
            )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
