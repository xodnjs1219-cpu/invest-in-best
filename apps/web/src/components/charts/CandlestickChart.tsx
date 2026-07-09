"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
} from "lightweight-charts";
import { getChartPalette, subscribeThemeChange } from "@/components/charts/chartTheme";

export interface CandlestickPoint {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  isClosingConfirmed?: boolean;
}

export interface CandlestickChartProps {
  candles: readonly CandlestickPoint[];
  height?: number;
}

/**
 * 일봉 캔들차트 프레젠테이션 래퍼(UC-020 plan 모듈 9) — lightweight-charts 5.x 기반.
 * 거래일만 표시(전달된 캔들만 시간축에 나열 — 누락 일자 보간 없음, spec §6.1), OHLC에 null이
 * 포함된 캔들은 시리즈에서 제외(갭 처리). isClosingConfirmed=false 캔들은 별도 색상으로 미확정 표기(E3).
 * 도메인 지식 없음(통화·기간 의미는 호출측 주입) — 순수 프레젠테이션 공통 모듈(techstack §4 components/charts).
 */
export function CandlestickChart({ candles, height = 320 }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  // 테마 전환(OS/토글) 시 차트를 재생성하기 위한 키. lightweight-charts는 색을 JS로 주입하므로 필요.
  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => subscribeThemeChange(() => setThemeKey((k) => k + 1)), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const palette = getChartPalette();

    const chart = createChart(container, {
      height,
      layout: {
        background: { color: palette.surface },
        textColor: palette.text,
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      timeScale: {
        borderColor: palette.grid,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      borderVisible: false,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        chart.resize(entry.contentRect.width, height);
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- height는 미지원 범위. themeKey 변경 시에만 재생성.
  }, [themeKey]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) {
      return;
    }

    const mutedColor = getChartPalette().muted;

    const data = candles
      .filter(
        (candle) =>
          candle.open !== null && candle.high !== null && candle.low !== null && candle.close !== null,
      )
      .map((candle) => ({
        time: candle.time,
        open: candle.open as number,
        high: candle.high as number,
        low: candle.low as number,
        close: candle.close as number,
        color: candle.isClosingConfirmed === false ? mutedColor : undefined,
      }));

    series.setData(data);

    const unconfirmedMarkers = candles
      .filter((candle) => candle.isClosingConfirmed === false)
      .map((candle) => ({
        time: candle.time as Time,
        position: "aboveBar" as const,
        color: mutedColor,
        shape: "circle" as const,
        text: "미확정",
      }));

    markersRef.current?.setMarkers(unconfirmedMarkers);

    chartRef.current?.timeScale().fitContent();
  }, [candles, themeKey]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
