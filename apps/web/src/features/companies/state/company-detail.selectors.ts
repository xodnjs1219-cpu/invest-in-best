import {
  FINANCIALS_PRESET_YEARS,
  presetToDailyRange,
  TIMESERIES_MIN_START_YEAR,
  type FinancialsPeriodPreset,
  type IsoDate,
  type QuotesPeriodPreset,
} from "@iib/domain";

/**
 * 기업 상세(UC-020) 파생 값 셀렉터(state_management.md §4.3) — 순수 함수, 상태가 아니다.
 * "오늘"/"현재 연도"는 인자로 주입해 순수성을 유지한다(Date.now() 직접 호출 금지).
 * 결과는 그대로 queryKey의 일부가 된다 — 상태 변경이 서버 재조회로 이어지는 유일한 연결 고리.
 */

/** quotesPeriod 프리셋 → quotes API의 from/to. UC-010 `presetToDailyRange` 재사용(FE/BE 이중 구현 금지). */
export function selectQuotesDateRange(
  period: QuotesPeriodPreset,
  today: IsoDate,
): { from: IsoDate; to: IsoDate } {
  return presetToDailyRange(period, today);
}

/** financialsPeriod 프리셋 → fromYear/toYear(fromYear는 2015 하한 클램프). */
export function selectFinancialsYearRange(
  period: FinancialsPeriodPreset,
  currentYear: number,
): { fromYear: number; toYear: number } {
  if (period === "ALL") {
    return { fromYear: TIMESERIES_MIN_START_YEAR, toYear: currentYear };
  }

  const years = FINANCIALS_PRESET_YEARS[period];
  const fromYear = Math.max(currentYear - years + 1, TIMESERIES_MIN_START_YEAR);
  return { fromYear, toYear: currentYear };
}
