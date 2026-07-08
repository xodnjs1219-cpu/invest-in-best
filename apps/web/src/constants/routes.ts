import { LEGAL_PAGE_SLUGS, type LegalPageDocType } from "@iib/domain";

/**
 * 앱 전역 라우트 경로 상수 (UC-025 plan A-2, R-1 확정).
 * 문자열 직접 기입 금지 — 약관 링크(UC-001 가입 폼, UC-003 Google 버튼 고지 문구),
 * 푸터(UC-007/025), 404 메인 복귀 링크(UC-025 B-6)가 모두 이 상수를 참조한다.
 */
export const ROUTES = {
  home: "/",
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  disclaimer: "/legal/disclaimer",
} as const;

/**
 * 정책 문서 종류(docType) → 경로 파생 맵.
 * `LEGAL_PAGE_SLUGS`(도메인 SOT)를 순회해 `/legal/{slug}`를 조립한다(경로 문자열 중복 기입 금지).
 */
export const LEGAL_ROUTES: Record<LegalPageDocType, string> = Object.fromEntries(
  Object.entries(LEGAL_PAGE_SLUGS).map(([slug, docType]) => [docType, `/legal/${slug}`]),
) as Record<LegalPageDocType, string>;
