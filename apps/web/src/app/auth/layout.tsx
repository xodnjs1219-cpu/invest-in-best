import type { Metadata } from "next";

/**
 * `/auth/*` 공통 레이아웃 — 인증 플로우 화면(로그인·가입·비밀번호 재설정·OAuth 콜백 등)을
 * 검색 색인에서 제외한다(비공개·기능성 페이지). 렌더링은 자식 페이지에 그대로 위임한다.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
