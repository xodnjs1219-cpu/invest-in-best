/**
 * SEC EDGAR 어댑터 계약 (docs/usecases/027/plan.md 모듈 9).
 * 잡이 의존하는 유일한 어댑터 표면.
 */

export type SecBulkKind = "submissions" | "companyfacts";

/** company_tickers.json 매핑 1건(UC-031 Phase 0 — 미국 종목 마스터 시드). */
export interface SecTickerEntry {
  cik: string; // 10자리 zero-pad
  ticker: string;
  title: string;
}

export interface SecBulkFreshness {
  lastModified: string | null;
}

export interface SecFilingEntry {
  accessionNumber: string;
  form: string;
  filingDate: string;
  primaryDocument: string;
}

export interface SecSubmissionsEntry {
  cik: string; // 10자리 zero-pad
  name: string;
  sic: string | null;
  sicDescription: string | null;
  stateOfIncorporationDescription: string | null;
  businessAddress: {
    street1: string | null;
    city: string | null;
    stateOrCountry: string | null;
    zipCode: string | null;
  } | null;
  phone: string | null;
  fiscalYearEnd: string | null;
  recentFilings: SecFilingEntry[];
}

/** facts 서브트리는 도메인 순수 함수(us-financials.ts) 입력용 원형 그대로 유지 — 어댑터는 최소 구조만 검증. */
export interface SecCompanyFactsEntry {
  cik: string;
  facts: Record<string, Record<string, unknown> | undefined>; // taxonomy -> tag -> {units:{...}}
}

export interface SecConceptResult {
  units: Record<string, Array<{ end: string; val: number; fy: number; fp: string; form: string; filed: string; accn: string }>>;
}

export interface SecBulkEntryError {
  cik: string;
  error: string;
}

export interface SecEdgarPort {
  /** 티커→CIK 전체 맵 1회 호출(UC-031 Phase 0 — 미국 종목 마스터 시드). */
  fetchTickerCikMap(): Promise<SecTickerEntry[]>;

  /** HEAD 요청으로 Last-Modified 확인(잡이 다운로드 강행 여부 판단). */
  checkBulkFreshness(kind: SecBulkKind): Promise<SecBulkFreshness>;

  /** 스트리밍으로 임시 파일 저장(메모리 비적재). */
  downloadBulk(kind: SecBulkKind, destPath: string): Promise<void>;

  /** yauzl로 대상 CIK 엔트리만 추출(전체 압축 해제 없음). 엔트리 단위 오류는 격리해 계속 순회한다. */
  readBulkEntries(
    zipPath: string,
    cikSet: Set<string>,
    kind: SecBulkKind,
  ): AsyncIterable<SecSubmissionsEntry | SecCompanyFactsEntry | SecBulkEntryError>;

  /** 상장주식수 폴백 체인 보완용(벌크 미포함 CIK). 404는 null(재시도 없음, E11). */
  fetchCompanyConcept(cik: string, taxonomy: string, tag: string): Promise<SecConceptResult | null>;

  /** 벌크 미포함 CIK 보완용 개별 조회. */
  fetchSubmissions(cik: string): Promise<SecSubmissionsEntry | null>;
}

/** 403/차단(User-Agent 미선언 또는 레이트리밋) — 보수적 백오프 신호(E7·E8). */
export class SecBlockedError extends Error {
  readonly kind: "user_agent" | "rate_limit";
  constructor(kind: "user_agent" | "rate_limit", message: string) {
    super(message);
    this.name = "SecBlockedError";
    this.kind = kind;
  }
}

export class SecRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SecRequestError";
    this.status = status;
  }
}
