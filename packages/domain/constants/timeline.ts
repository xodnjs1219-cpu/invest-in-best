/**
 * 밸류체인 뷰 타임라인·대시보드 기간 상수 (docs/pages/chain-view/state_management.md §1·§4,
 * 결정 C-5·C-6). chain-view 페이지(UC-009~012) FE 상태 모듈이 공유하는 SOT.
 */

/** 시계열 조회 가능 최소 일자(`quarterly_financials.fiscal_year >= 2015` 정책과 정합, database.md). */
export const TIMESERIES_MIN_START_DATE = "2015-01-01";

/** 타임라인 날짜 경계 시간대 — Asia/Seoul 고정, 당일 종료(23:59:59) 경계 포함(결정 C-6). */
export const TIMELINE_TIMEZONE = "Asia/Seoul";

/** 대시보드 기본 조회 기간 프리셋 — 최근 1년(결정 C-5). */
export const DASHBOARD_DEFAULT_RANGE = { kind: "preset", preset: "1Y" } as const;

/** 대시보드 기간 프리셋 목록. */
export const METRICS_RANGE_PRESETS = ["1M", "3M", "6M", "1Y", "3Y", "MAX"] as const;

export type MetricsRangePreset = (typeof METRICS_RANGE_PRESETS)[number];
