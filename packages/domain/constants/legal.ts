/**
 * 약관 문서 상수 — 단일 SOT (결정 A-4, G-1 / UC-025 BR-3).
 * UC-025 정책 페이지 표기와 `terms_agreements.doc_version` 기록이 모두 이 상수를 참조한다.
 * 버전 값 변경은 반드시 이 파일에서만 한다.
 */
import { DATA_SOURCE_LABELS } from "./data-freshness";

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

/**
 * UC-025: 정책 페이지 표기용 문서 종류.
 * DB enum `terms_doc_type`(2종)과 분리 정의한다 — 면책 문서는 동의 대상이 아니므로(BR-4)
 * DB enum에는 추가하지 않고 라우트 식별자로만 존재한다.
 */
export type LegalPageDocType = TermsDocType | "investment_disclaimer";

/**
 * 정책 페이지 데이터 계약(spec §6.2): docType 필드를 포함한 문서 콘텐츠.
 * `LegalDoc`의 필드 상위집합이며 `docType`으로 자기 식별한다.
 */
export type LegalDocContent = LegalDoc & { docType: LegalPageDocType };

export const LEGAL_DOCS: Record<TermsDocType, LegalDocContent> = {
  terms_of_service: {
    docType: "terms_of_service",
    title: "이용약관",
    body: "본 이용약관은 서비스 정식 오픈 전 확정 예정인 플레이스홀더 문안입니다.",
    version: "v1.0",
    effectiveDate: "2026-07-01",
  },
  privacy_policy: {
    docType: "privacy_policy",
    title: "개인정보처리방침",
    body: "본 개인정보처리방침은 서비스 정식 오픈 전 확정 예정인 플레이스홀더 문안입니다.",
    version: "v1.0",
    effectiveDate: "2026-07-01",
  },
};

/**
 * 투자 면책 문구 전문 (결정 G-1 플레이스홀더). 열람 전용 — 동의 수집 대상이 아니다(BR-4).
 */
export const INVESTMENT_DISCLAIMER_DOC: LegalDocContent = {
  docType: "investment_disclaimer",
  title: "투자 면책 문구",
  body: "본 서비스가 제공하는 모든 데이터와 지표는 정보 제공 목적으로만 제공되며, 특정 종목·투자전략에 대한 투자 권유나 자문이 아닙니다.\n\n투자 판단과 그 결과에 대한 책임은 전적으로 투자자 본인에게 있으며, 서비스 운영자는 데이터의 정확성·완전성·적시성에 대해 어떠한 보증도 하지 않습니다.",
  version: "v1.0",
  effectiveDate: "2026-07-01",
};

/**
 * 정책 페이지 3종 통합 조회 맵(BR-2). terms_of_service/privacy_policy 항목은
 * `LEGAL_DOCS`의 동일 객체를 참조한다(복사 금지 — BR-3/E4: doc_version 기록과 페이지 표기의
 * 구조적 동기화 보장).
 */
export const LEGAL_PAGE_DOCS: Record<LegalPageDocType, LegalDocContent> = {
  terms_of_service: LEGAL_DOCS.terms_of_service,
  privacy_policy: LEGAL_DOCS.privacy_policy,
  investment_disclaimer: INVESTMENT_DISCLAIMER_DOC,
};

/**
 * URL 마지막 세그먼트(slug) → docType 맵. 경로 접두어(`/legal`)는 웹 계층
 * `apps/web/src/constants/routes.ts` 소관 — 도메인 패키지는 URL 전체를 알지 못한다.
 */
export const LEGAL_PAGE_SLUGS = {
  terms: "terms_of_service",
  privacy: "privacy_policy",
  disclaimer: "investment_disclaimer",
} as const satisfies Record<string, LegalPageDocType>;

/** 정책 문서 순수 조회 헬퍼 — 페이지 3종(RSC)이 사용한다. */
export function getLegalPageDoc(docType: LegalPageDocType): LegalDocContent {
  return LEGAL_PAGE_DOCS[docType];
}

/**
 * 데이터 출처 표기 정책 문구(BR-7). 출처 **명칭 목록**은 여기 중복 정의하지 않고
 * `data-freshness.ts`의 `DATA_SOURCE_LABELS`를 재사용한다(DRY, A-4).
 */
export const DATA_SOURCE_POLICY_TEXT = `본 서비스가 제공하는 데이터는 ${DATA_SOURCE_LABELS.join(", ")} 등 공신력 있는 출처로부터 수집되며, 각 데이터는 원 출처와 수집 시점을 화면에 표기하는 것을 원칙으로 합니다. 데이터는 정보 제공 목적으로만 제공되며 투자 권유가 아닙니다.`;

/** 전역 푸터 정책 링크 라벨(spec §6.2 "푸터 데이터 계약"). 하드코딩 금지 — 컴포넌트는 이 상수만 참조. */
export const FOOTER_LEGAL_LINK_LABELS: Record<LegalPageDocType, string> = {
  terms_of_service: "이용약관",
  privacy_policy: "개인정보처리방침",
  investment_disclaimer: "투자 면책 문구",
};
