import Link from "next/link";
import { DISCLAIMER_SUMMARY_TEXT } from "@iib/domain";

const TERMS_PATH = "/terms";
const PRIVACY_PATH = "/privacy";

/**
 * 전역 푸터 (UC-007 plan 모듈 A-7) — 면책 요약(결정 G-2) + 약관/개인정보 링크.
 * 순수 Presenter(상태·로직 없음). 루트 레이아웃에 장착해 전 페이지 상시 노출한다(UC-025 규칙).
 * 정책 페이지 본문(/terms, /privacy)은 UC-025 plan 소관 — 여기서는 링크 경로만 정의한다.
 */
export function AppFooter() {
  return (
    <footer className="mt-auto flex flex-col items-center gap-2 border-t border-gray-100 px-4 py-6 text-center text-xs text-gray-500">
      <p className="max-w-2xl">{DISCLAIMER_SUMMARY_TEXT}</p>
      <nav className="flex gap-4">
        <Link href={TERMS_PATH} className="underline hover:text-gray-700">
          이용약관
        </Link>
        <Link href={PRIVACY_PATH} className="underline hover:text-gray-700">
          개인정보처리방침
        </Link>
      </nav>
    </footer>
  );
}
