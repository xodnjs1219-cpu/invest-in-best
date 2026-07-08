/**
 * OpenDART 어댑터 계약 (docs/usecases/027/plan.md 모듈 7).
 * 잡이 의존하는 유일한 어댑터 표면 — ZIP/XML 파싱·HTTP 구현 세부는 client.ts/dto.ts에 격리한다.
 */

/** corpCode.xml 매핑(상장 법인만 — stock_code 비공란 필터는 구현 책임). */
export interface CorpCodeMapping {
  corpCode: string;
  stockCode: string;
  corpName: string;
  modifyDate: string; // YYYYMMDD
}

/** 정규화된 국내 공시(list.json). */
export interface NormalizedKrxDisclosure {
  rceptNo: string;
  stockCode: string;
  corpCode: string;
  title: string;
  disclosureDate: string; // yyyy-MM-dd
  url: string;
}

export interface KrxMetricAmount {
  threeMonth: number | null;
  cumulative: number | null;
}

/** 다중/단일회사 재무제표 조회 결과 — 종목당 지표별(threeMonth/cumulative) 금액. */
export interface KrxAccountSet {
  corpCode: string;
  bsnsYear: number;
  reprtCode: string;
  fsDiv: "CFS" | "OFS";
  metrics: {
    revenue?: KrxMetricAmount;
    operatingIncome?: KrxMetricAmount;
    netIncome?: KrxMetricAmount;
  };
}

/** 주식총수현황(stockTotqySttus) 합계 행. */
export interface KrxStockTotal {
  corpCode: string;
  totalShares: number;
  settlementDate: string; // yyyy-MM-dd
}

/** 기업개황(company.json). */
export interface KrxCompanyProfile {
  corpCode: string;
  representativeName: string | null;
  establishedDate: string | null;
  homepageUrl: string | null;
  sector: string | null;
  industryCode: string | null;
  address: string | null;
  phone: string | null;
}

export interface FetchDisclosuresResult {
  items: NormalizedKrxDisclosure[];
}

export interface FetchMultiAccountsResult {
  accounts: KrxAccountSet[];
  /** 요청했으나 응답에 없는 corp_code(회사 미제출 등 — 호출 실패 아님). */
  missingCorpCodes: string[];
}

/**
 * OpenDART Open API 포트. 잡 로직은 이 인터페이스에만 의존한다.
 */
export interface OpenDartPort {
  /** ZIP 1회 다운로드로 전체 매핑 확보(Main 4). */
  fetchCorpCodeMappings(): Promise<CorpCodeMapping[]>;

  /** corp_code 생략 + 날짜 기준 페이지네이션 내장(Main 5). */
  fetchDisclosures(bgnDe: string, endDe: string): Promise<FetchDisclosuresResult>;

  /** 100사 청크 내장(Main 6, BR-4). 응답에 없는 corp는 missingCorpCodes로 반환. */
  fetchMultiAccounts(
    corpCodes: string[],
    bsnsYear: number,
    reprtCode: string,
  ): Promise<FetchMultiAccountsResult>;

  /** CFS→OFS 폴백 내장(BR-11). 양쪽 013이면 null(E4). */
  fetchFullFinancials(corpCode: string, bsnsYear: number, reprtCode: string): Promise<KrxAccountSet | null>;

  /** 회사당 1회, 결측 허용(E4). */
  fetchStockTotal(corpCode: string, bsnsYear: number, reprtCode: string): Promise<KrxStockTotal | null>;

  /** 기업개황, 결측 허용(E4). */
  fetchCompanyProfile(corpCode: string): Promise<KrxCompanyProfile | null>;

  /**
   * 공시서류원본파일(document.xml) → 평문 텍스트(docs/usecases/030/plan.md 모듈 7 — UC-030 최초 정의).
   * null = 원문 확보 불가(폴백 신호, 오류 아님 — R-3). 재시도 소진·문서 없음(013)·일일 한도(020)·키 부재 모두 null.
   */
  fetchDisclosureDocumentText(rceptNo: string): Promise<string | null>;
}

/** OpenDART status=020(일일 한도 초과) — 재시도 금지, 잡의 이월 신호(E1). */
export class DartQuotaExceededError extends Error {
  constructor(message = "OpenDART 일일 요청 한도(20,000건) 초과") {
    super(message);
    this.name = "DartQuotaExceededError";
  }
}

/** OpenDART status=010/011/012/901(키/IP 문제) — 잡 수준 실패 신호. */
export class DartAuthError extends Error {
  readonly status: string;
  constructor(status: string, message: string) {
    super(message);
    this.name = "DartAuthError";
    this.status = status;
  }
}

/** OpenDART status=800(시스템 점검) — 재시도 대상(E19). */
export class DartMaintenanceError extends Error {
  constructor(message = "OpenDART 시스템 점검 중") {
    super(message);
    this.name = "DartMaintenanceError";
  }
}

/** 그 외 OpenDART 오류 응답(status/message 보존). */
export class DartRequestError extends Error {
  readonly status: string;
  constructor(status: string, message: string) {
    super(message);
    this.name = "DartRequestError";
    this.status = status;
  }
}
