import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSsrServerClient } from "@/lib/supabase/server-client";

/** 로그인 전용 영역 — 검색 색인 제외(개인화·비공개 콘텐츠). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `(protected)/*` 화면 공통 로그인 가드 (UC-013 plan 모듈 15).
 * 서버 컴포넌트에서 세션을 확인해 비로그인 접근을 차단한다(E1).
 * 레이아웃 레벨에서는 정확한 복귀 경로(returnTo)를 알 수 없으므로 안전한 기본값(`/auth/login`)으로
 * 리다이렉트한다 — 각 페이지가 자신의 경로를 알고 있으므로 필요 시 `returnTo`를 포함해 재확인한다
 * (예: `account/page.tsx`가 이미 이 패턴을 사용 중).
 * **화면 가드는 UX 편의일 뿐이며 인가의 진실은 API 미들웨어다** — 우회되어도 API가 401로 최종 방어한다.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createSsrServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return children;
}
