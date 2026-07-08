/**
 * 국내(KRX) 분기 정규화 (docs/usecases/027/plan.md 모듈 3).
 * 순수 함수 — OpenDART 손익 원천값(3개월치/누적치)을 quarterly_financials 행 모델로 변환한다.
 * BR-10·BR-11·BR-16, E2·E4, OQ-3(1Q 결측 시 반기 3개월치 폴백).
 */
import {
  DART_REPORT_CODES,
  DART_REPORT_DEADLINE_DAYS,
  FINANCIALS_MIN_FISCAL_YEAR,
  type DartReportCode,
} from "../constants/financials";

export interface PeriodAmount {
  threeMonth: number | null;
  cumulative: number | null;
}

export interface KrxQuarterInput {
  fiscalYear: number;
  metric: "revenue" | "operatingIncome" | "netIncome";
  q1: PeriodAmount | null;
  half: PeriodAmount | null;
  q3: PeriodAmount | null;
  annual: PeriodAmount | null;
}

export type AmountBasis = "three_month" | "derived_from_cumulative";

export interface KrxQuarterRow {
  fiscalYear: number;
  periodType: "quarter" | "annual";
  fiscalQuarter: 1 | 2 | 3 | 4 | null;
  amount: number;
  amountBasis: AmountBasis | null;
}

/**
 * 종목의 회계연도별 지표당 원천값 → quarterly_financials 행 모델(분기 4행 + 연간 1행, 산출 가능한 것만).
 * fiscal_year < FINANCIALS_MIN_FISCAL_YEAR 입력은 결과에서 제외(E2 — DB CHECK가 최종 방어).
 */
export function normalizeKrxQuarters(input: KrxQuarterInput): KrxQuarterRow[] {
  if (input.fiscalYear < FINANCIALS_MIN_FISCAL_YEAR) {
    return [];
  }

  const rows: KrxQuarterRow[] = [];

  // 1Q: 원천 3개월치(threeMonth) 우선, 없으면 동일 기간의 누적치(1Q는 누적=3개월과 같음).
  const q1Amount = input.q1?.threeMonth ?? input.q1?.cumulative ?? null;
  if (q1Amount !== null) {
    rows.push({
      fiscalYear: input.fiscalYear,
      periodType: "quarter",
      fiscalQuarter: 1,
      amount: q1Amount,
      amountBasis: "three_month",
    });
  }

  // 2Q: 반기 누적 - 1Q 누적(차감 도출). 1Q 결측 시 반기 원천 3개월치로 폴백(OQ-3).
  const q1Cumulative = input.q1?.cumulative ?? null;
  const halfCumulative = input.half?.cumulative ?? null;
  if (q1Cumulative !== null && halfCumulative !== null) {
    rows.push({
      fiscalYear: input.fiscalYear,
      periodType: "quarter",
      fiscalQuarter: 2,
      amount: halfCumulative - q1Cumulative,
      amountBasis: "derived_from_cumulative",
    });
  } else if (input.half?.threeMonth !== null && input.half?.threeMonth !== undefined) {
    rows.push({
      fiscalYear: input.fiscalYear,
      periodType: "quarter",
      fiscalQuarter: 2,
      amount: input.half.threeMonth,
      amountBasis: "three_month",
    });
  }

  // 3Q: 원천 3개월치 우선, 결측 시 3Q 누적 - 반기 누적으로 차감 도출.
  const q3ThreeMonth = input.q3?.threeMonth ?? null;
  const q3Cumulative = input.q3?.cumulative ?? null;
  if (q3ThreeMonth !== null) {
    rows.push({
      fiscalYear: input.fiscalYear,
      periodType: "quarter",
      fiscalQuarter: 3,
      amount: q3ThreeMonth,
      amountBasis: "three_month",
    });
  } else if (q3Cumulative !== null && halfCumulative !== null) {
    rows.push({
      fiscalYear: input.fiscalYear,
      periodType: "quarter",
      fiscalQuarter: 3,
      amount: q3Cumulative - halfCumulative,
      amountBasis: "derived_from_cumulative",
    });
  }

  // 4Q: 연간 - 3Q 누적. 3Q 누적 결측 시 미산출(E4 결측 허용).
  const annualCumulative = input.annual?.cumulative ?? null;
  if (annualCumulative !== null && q3Cumulative !== null) {
    rows.push({
      fiscalYear: input.fiscalYear,
      periodType: "quarter",
      fiscalQuarter: 4,
      amount: annualCumulative - q3Cumulative,
      amountBasis: "derived_from_cumulative",
    });
  }

  // 연간 행: annual 값 그대로.
  if (annualCumulative !== null) {
    rows.push({
      fiscalYear: input.fiscalYear,
      periodType: "annual",
      fiscalQuarter: null,
      amount: annualCumulative,
      amountBasis: null,
    });
  }

  return rows;
}

/**
 * 오늘 날짜 기준 "제출 윈도우가 열려 있거나 최근 마감된" 보고서 목록.
 * 12월 결산 가정: 4~5월(1Q 마감 임박/직후, 45일 기한)에는 당해 1Q + 전년 사업보고서(90일 기한 시즌 직후)를 포함.
 */
export function resolveDartTargetReports(
  today: Date,
): Array<{ bsnsYear: number; reprtCode: DartReportCode }> {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1; // 1-12
  const day = today.getUTCDate();

  const results: Array<{ bsnsYear: number; reprtCode: DartReportCode }> = [];

  // 사업보고서(전년도) 제출 기한: 익년 3/31(약 90일). 1~3월은 제출 시즌 진행 중.
  if (month <= 3) {
    results.push({ bsnsYear: year - 1, reprtCode: DART_REPORT_CODES.ANNUAL });
    // 3월 하순 이후는 곧 1Q 시즌도 겹칠 수 있으나 보수적으로 사업보고서만.
    if (month === 3 && day >= 25) {
      results.push({ bsnsYear: year - 1, reprtCode: DART_REPORT_CODES.Q3 });
    }
  } else if (month <= 5) {
    // 1분기보고서 제출 기한: 4/1~5/15 근방(45일). 사업보고서 마감 직후 잔여 확인도 포함.
    results.push({ bsnsYear: year, reprtCode: DART_REPORT_CODES.Q1 });
    results.push({ bsnsYear: year - 1, reprtCode: DART_REPORT_CODES.ANNUAL });
  } else if (month <= 8) {
    // 반기보고서 제출 기한: 8/14 근방.
    results.push({ bsnsYear: year, reprtCode: DART_REPORT_CODES.HALF });
    results.push({ bsnsYear: year, reprtCode: DART_REPORT_CODES.Q1 });
  } else if (month <= 11) {
    // 3분기보고서 제출 기한: 11/14 근방.
    results.push({ bsnsYear: year, reprtCode: DART_REPORT_CODES.Q3 });
    results.push({ bsnsYear: year, reprtCode: DART_REPORT_CODES.HALF });
  } else {
    // 12월: 다음 시즌(사업보고서) 대비 직전 3Q 재확인.
    results.push({ bsnsYear: year, reprtCode: DART_REPORT_CODES.Q3 });
  }

  return results;
}

/**
 * (bsnsYear, reprtCode) → 회계 기간 시작·종료일 산출(12월 결산 가정 순수 함수).
 * 응답에 실제 기간 문자열이 있으면 어댑터 정규화 단계에서 그것을 우선 사용해야 한다.
 */
export function resolveKrxPeriod(
  bsnsYear: number,
  reprtCode: DartReportCode,
  fiscalYearEndMonth = 12,
): { start: string; end: string } {
  if (fiscalYearEndMonth !== 12) {
    throw new Error("non-December fiscal year end requires actual period strings from the API response");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (reprtCode) {
    case DART_REPORT_CODES.Q1:
      return { start: `${bsnsYear}-01-01`, end: `${bsnsYear}-03-31` };
    case DART_REPORT_CODES.HALF:
      return { start: `${bsnsYear}-04-01`, end: `${bsnsYear}-06-30` };
    case DART_REPORT_CODES.Q3:
      return { start: `${bsnsYear}-07-01`, end: `${bsnsYear}-09-30` };
    case DART_REPORT_CODES.ANNUAL:
      return { start: `${bsnsYear}-01-01`, end: `${bsnsYear}-12-31` };
    default:
      throw new Error(`unknown reprtCode: ${String(reprtCode)} (year=${pad(bsnsYear)})`);
  }
}

// re-export for callers that only need the deadline offsets (used by resolveDartTargetReports doc/tests).
export { DART_REPORT_DEADLINE_DAYS };
