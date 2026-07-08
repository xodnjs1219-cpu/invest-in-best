/**
 * 밸류체인 대시보드 지표(일별/분기) 상수 (UC-010 plan 모듈 1, 결정 C-4~C-8).
 * `TIMESERIES_MIN_START_DATE`/`DASHBOARD_DEFAULT_RANGE`/`METRICS_RANGE_PRESETS`는
 * `constants/timeline.ts`가 이미 정의(UC-009 chain-view 페이지 공통 SOT)하므로 재노출만 한다 — 중복 정의 금지.
 */
export {
  TIMESERIES_MIN_START_DATE,
  DASHBOARD_DEFAULT_RANGE,
  METRICS_RANGE_PRESETS,
  type MetricsRangePreset,
} from "./timeline";

/** 시계열 조회 가능 최소 역년(2015 사업연도, spec E8). */
export const TIMESERIES_MIN_CALENDAR_YEAR = 2015;
export const TIMESERIES_MIN_CALENDAR_QUARTER = 1;

/** 지표 응답 기준 통화·환산 기준 리터럴(spec §6.3 annotations). */
export const METRICS_BASE_CURRENCY = "KRW";
export const METRICS_FX_BASIS_DAILY = "daily";
export const METRICS_FX_BASIS_QUARTER_END = "quarter_end";
