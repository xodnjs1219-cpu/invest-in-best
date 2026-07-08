"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
} from "lightweight-charts";

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

const CHART_COLORS_LIGHT = {
  background: "#fcfcfb",
  text: "#52514e",
  grid: "#e5e4e0",
  upColor: "#1a7f4b",
  downColor: "#c0392b",
  unconfirmedColor: "#9a9890",
};

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      height,
      layout: {
        background: { color: CHART_COLORS_LIGHT.background },
        textColor: CHART_COLORS_LIGHT.text,
      },
      grid: {
        vertLines: { color: CHART_COLORS_LIGHT.grid },
        horzLines: { color: CHART_COLORS_LIGHT.grid },
      },
      timeScale: {
        borderColor: CHART_COLORS_LIGHT.grid,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS_LIGHT.upColor,
      downColor: CHART_COLORS_LIGHT.downColor,
      borderVisible: false,
      wickUpColor: CHART_COLORS_LIGHT.upColor,
      wickDownColor: CHART_COLORS_LIGHT.downColor,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 차트 인스턴스는 마운트 시 1회만 생성(height 변경은 미지원 범위).
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) {
      return;
    }

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
        color: candle.isClosingConfirmed === false ? CHART_COLORS_LIGHT.unconfirmedColor : undefined,
      }));

    series.setData(data);

    const unconfirmedMarkers = candles
      .filter((candle) => candle.isClosingConfirmed === false)
      .map((candle) => ({
        time: candle.time as Time,
        position: "aboveBar" as const,
        color: CHART_COLORS_LIGHT.unconfirmedColor,
        shape: "circle" as const,
        text: "미확정",
      }));

    markersRef.current?.setMarkers(unconfirmedMarkers);

    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
