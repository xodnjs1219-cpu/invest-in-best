/**
 * 재무 도메인 상수 (docs/usecases/027/plan.md 모듈 1).
 * 프레임워크·DB 의존성 없음 — UC-027/029/030/031이 공유하는 SOT.
 * 하드코딩 금지 원칙: 태그 폴백 체인·계정 매핑·기간 검증 상수를 전부 이곳에 배열/객체로 정의한다.
 */

/** 국내 재무 시계열 최소 시작 사업연도(BR-16, OpenDART 제약, DB CHECK와 일치). */
export const FINANCIALS_MIN_FISCAL_YEAR = 2015;

/** OpenDART 보고서 코드(DS002/DS003 공통, reprt_code). */
export const DART_REPORT_CODES = {
  Q1: "11013",
  HALF: "11012",
  Q3: "11014",
  ANNUAL: "11011",
} as const;

export type DartReportCode = (typeof DART_REPORT_CODES)[keyof typeof DART_REPORT_CODES];

/** 보고서 종류별 제출 기한 오프셋(일) — resolveDartTargetReports의 시즌 판정 입력. */
export const DART_REPORT_DEADLINE_DAYS = {
  QUARTERLY: 45, // 분기·반기보고서: 분기 종료 후 45일 이내
  ANNUAL: 90, // 사업보고서: 사업연도 종료 후 90일 이내
} as const;

/** 계정과목 매핑 항목 — account_id 우선, 계정명 폴백. */
export interface DartAccountMatcher {
  accountId?: string;
  accountNm?: string[];
}

/** 국내 계정 → 표준 지표 매핑(다중회사/단일회사 API 공용, BR-11 연계). */
export const DART_ACCOUNT_MAP: {
  revenue: DartAccountMatcher[];
  operatingIncome: DartAccountMatcher[];
  netIncome: DartAccountMatcher[];
} = {
  revenue: [
    { accountId: "ifrs-full_Revenue" },
    { accountNm: ["매출액", "수익(매출액)", "영업수익"] },
  ],
  operatingIncome: [
    { accountId: "dart_OperatingIncomeLoss" },
    { accountNm: ["영업이익", "영업이익(손실)"] },
  ],
  netIncome: [
    { accountId: "ifrs-full_ProfitLoss" },
    { accountNm: ["당기순이익", "당기순이익(손실)"] },
  ],
};

/** 미국 매출 태그 폴백 체인(BR-12) — us-gaap 5종 + ifrs-full 1종. 순서가 우선순위. */
export const US_REVENUE_TAG_CHAIN = [
  "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
  "us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax",
  "us-gaap:Revenues",
  "us-gaap:SalesRevenueNet",
  "us-gaap:SalesRevenueGoodsNet",
  "us-gaap:SalesRevenueServicesNet",
  "ifrs-full:Revenue",
] as const;

/** 미국 영업이익/순이익 태그(매출과 별도 파이프라인, us-gaap 우선). */
export const US_OPERATING_INCOME_TAG_CHAIN = [
  "us-gaap:OperatingIncomeLoss",
  "ifrs-full:ProfitLossFromOperatingActivities",
] as const;

export const US_NET_INCOME_TAG_CHAIN = [
  "us-gaap:NetIncomeLoss",
  "ifrs-full:ProfitLoss",
] as const;

/** 미국 상장주식수 폴백 체인(E12) — 1단계만 partial=false. */
export const SEC_SHARES_TAG_CHAIN: ReadonlyArray<{
  tag: string;
  partial: boolean;
}> = [
  { tag: "dei:EntityCommonStockSharesOutstanding", partial: false },
  { tag: "us-gaap:CommonStockSharesOutstanding", partial: true },
  { tag: "us-gaap:WeightedAverageNumberOfSharesOutstandingBasic", partial: true },
];

/** 미국 공시 form 화이트리스트(OQ-2) — '/A' 정정 변형은 접미 매칭 규칙으로 별도 처리. */
export const US_DISCLOSURE_FORMS = ["10-K", "10-Q", "8-K", "20-F", "40-F", "6-K"] as const;

/** 정상 분기/연간 기간 길이(일) 검증 범위 — E14 스텁 기간 검출(sec-edgar-api.md §8.4). */
export const QUARTER_PERIOD_DAYS = { min: 75, max: 100 } as const;
export const ANNUAL_PERIOD_DAYS = { min: 340, max: 390 } as const;

/**
 * 국내 결산월 기본값(UC-031 Phase 2 — 기업개황 확보 실패 corp의 안전 기본값, 대부분 12월 결산).
 * 결산월 미보유 corp는 이 값으로 간주하고 경고 로그를 남긴다(plan.md 모듈 17.4).
 */
export const DEFAULT_KRX_SETTLEMENT_MONTH = 12;
