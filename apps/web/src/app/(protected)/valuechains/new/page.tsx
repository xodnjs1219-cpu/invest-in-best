import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSsrServerClient } from "@/lib/supabase/server-client";
import { ChainEditorPage } from "@/features/valuechains/editor/components/ChainEditorPage";

const NEW_CHAIN_PATH = "/valuechains/new";

export const metadata: Metadata = {
  title: "새 밸류체인 만들기",
};

/**
 * 밸류체인 신규 생성 라우트 셸 (UC-013 plan 모듈 14).
 * Server Component — 데이터 페칭 없이 클라이언트 경계(`ChainEditorPage`)만 배치한다.
 * 세션이 없으면 정확한 복귀 경로(`returnTo=/valuechains/new`)로 로그인 페이지로 리다이렉트한다(E1)
 * — `(protected)/layout.tsx`의 공통 가드보다 먼저 실행되어 정밀한 복귀 경로를 보장한다.
 */
export default async function NewChainPage() {
  const cookieStore = await cookies();
  const supabase = createSsrServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(NEW_CHAIN_PATH)}`);
  }

  return <ChainEditorPage mode="create" variant="user" />;
}
