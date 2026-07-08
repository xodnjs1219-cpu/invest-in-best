/**
 * 기업 상세(UC-020) 도메인 상수 (docs/usecases/020/plan.md 모듈 1).
 * 프레임워크·DB 의존성 없음 — FE(features/companies)와 BE(features/companies/backend)가 공유하는 SOT.
 * 하드코딩 금지 원칙: 기간 프리셋·페이지 크기·주식수 소스 우선순위를 전부 이곳에 정의한다.
 */
import { METRICS_RANGE_PRESETS, TIMESERIES_MIN_CALENDAR_YEAR } from "./metrics";
import type { MetricsRangePreset } from "./metrics";

/** 주가/시총 조회 기간 프리셋 — UC-010 `METRICS_RANGE_PRESETS` 재수출(SOT 이원화 금지). */
export const QUOTES_PERIOD_PRESETS = METRICS_RANGE_PRESETS;
export type QuotesPeriodPreset = MetricsRangePreset;

/** 주가/시총 기본 조회 기간 — 최근 1년(결정 C-5 준용). */
export const QUOTES_DEFAULT_PERIOD = "1Y" satisfies QuotesPeriodPreset;

/** 분기 재무 조회 기간 프리셋. */
export const FINANCIALS_PERIOD_PRESETS = ["3Y", "5Y", "10Y", "ALL"] as const;
export type FinancialsPeriodPreset = (typeof FINANCIALS_PERIOD_PRESETS)[number];

/** 분기 재무 기본 조회 기간. */
export const FINANCIALS_DEFAULT_PERIOD = "5Y" satisfies FinancialsPeriodPreset;

/** 프리셋별 조회 연수(ALL 제외 — ALL은 TIMESERIES_MIN_START_YEAR부터). */
export const FINANCIALS_PRESET_YEARS: Record<Exclude<FinancialsPeriodPreset, "ALL">, number> = {
  "3Y": 3,
  "5Y": 5,
  "10Y": 10,
};

/** 재무 시계열 조회 가능 최소 사업연도 — UC-010 `TIMESERIES_MIN_CALENDAR_YEAR` 재수출(SOT 이원화 금지, spec §6.1). */
export const TIMESERIES_MIN_START_YEAR = TIMESERIES_MIN_CALENDAR_YEAR;

/** 공시 목록 페이지당 건수(spec §6.1). */
export const DISCLOSURES_PAGE_SIZE = 20;

/** 상장주식수 소스 우선순위(database.md §3.5) — 동일 as_of_date 복수 소스 행의 타이브레이크. */
export const SHARES_SOURCE_PRIORITY = ["toss", "dart", "sec"] as const;
export type SharesSource = (typeof SHARES_SOURCE_PRIORITY)[number];

/** 최신 상장주식수 후보 조회 상한(repository 쿼리 limit). */
export const SHARES_LOOKUP_LIMIT = 5;
