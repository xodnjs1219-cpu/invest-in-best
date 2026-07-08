/**
 * 약관 문서 상수 — 단일 SOT (결정 A-4, G-1 / UC-025 BR-3).
 * UC-025 정책 페이지 표기와 `terms_agreements.doc_version` 기록이 모두 이 상수를 참조한다.
 * 버전 값 변경은 반드시 이 파일에서만 한다.
 */

/** DB enum `terms_doc_type`과 동일한 리터럴. */
export type TermsDocType = "terms_of_service" | "privacy_policy";

/** 가입 시 필수 동의 약관 2종. */
export const REQUIRED_TERMS_DOC_TYPES = ["terms_of_service", "privacy_policy"] as const;

export type LegalDoc = {
  title: string;
  /** 본문 플레이스홀더 (결정 G-1 — 실제 법률 문안은 별도 확정). */
  body: string;
  /** `terms_agreements.doc_version`에 기록되는 정적 버전 문자열 (결정 A-4). */
  version: string;
  /** 시행일 (ISO 8601 날짜). */
  effectiveDate: string;
};

/**
 * 전역 푸터 면책 요약 문구 (결정 G-2 임시 문안, UC-007 plan 모듈 A-2).
 * 운영 확정 시 이 상수만 교체한다 — 컴포넌트에 하드코딩 금지.
 */
export const DISCLAIMER_SUMMARY_TEXT =
  "본 서비스의 모든 정보는 투자 판단의 참고 자료이며, 투자 권유가 아닙니다. 투자의 책임은 투자자 본인에게 있습니다.";

export const LEGAL_DOCS: Record<TermsDocType, LegalDoc> = {
  terms_of_service: {
    title: "이용약관",
    body: "본 이용약관은 서비스 정식 오픈 전 확정 예정인 플레이스홀더 문안입니다.",
    version: "v1.0",
    effectiveDate: "2026-07-01",
  },
  privacy_policy: {
    title: "개인정보처리방침",
    body: "본 개인정보처리방침은 서비스 정식 오픈 전 확정 예정인 플레이스홀더 문안입니다.",
    version: "v1.0",
    effectiveDate: "2026-07-01",
  },
};
