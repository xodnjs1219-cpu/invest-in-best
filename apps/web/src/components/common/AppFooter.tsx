import Link from "next/link";
import { DISCLAIMER_SUMMARY_TEXT, FOOTER_LEGAL_LINK_LABELS, LEGAL_PAGE_DOCS } from "@iib/domain";
import { LEGAL_ROUTES } from "@/constants/routes";

/**
 * 전역 푸터 (UC-007 plan 모듈 A-7, UC-025 plan A-3 확장) — 면책 요약(결정 G-2) +
 * 정책 링크 3종(이용약관/개인정보처리방침/투자 면책 문구).
 * 순수 Presenter(상태·로직 없음). 루트 레이아웃에 장착해 전 페이지 상시 노출한다(BR-5/E5).
 * 링크는 `LEGAL_PAGE_DOCS` 키 순회 × `FOOTER_LEGAL_LINK_LABELS`(라벨) × `LEGAL_ROUTES`(경로)
 * 매핑으로 렌더한다 — 문서 종류가 늘어도 푸터 수정이 불필요한 구조(BR-2).
 */
export function AppFooter() {
  const legalDocTypes = Object.keys(LEGAL_PAGE_DOCS) as (keyof typeof LEGAL_PAGE_DOCS)[];

  return (
    <footer className="mt-auto flex flex-col items-center gap-2 border-t border-border px-4 py-6 text-center text-xs text-fg-muted">
      <p className="max-w-2xl">{DISCLAIMER_SUMMARY_TEXT}</p>
      <nav className="flex gap-4">
        {legalDocTypes.map((docType) => (
          <Link
            key={docType}
            href={LEGAL_ROUTES[docType]}
            className="underline underline-offset-2 transition-colors hover:text-fg"
          >
            {FOOTER_LEGAL_LINK_LABELS[docType]}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
