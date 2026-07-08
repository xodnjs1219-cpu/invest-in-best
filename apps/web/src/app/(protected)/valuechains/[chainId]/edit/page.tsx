import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSsrServerClient } from "@/lib/supabase/server-client";
import { ChainEditorPage } from "@/features/valuechains/editor/components/ChainEditorPage";

export const metadata: Metadata = {
  title: "밸류체인 편집",
};

interface EditChainPageProps {
  params: Promise<{ chainId: string }>;
}

/**
 * 밸류체인 편집 진입 라우트 셸 (UC-018 plan 모듈 20, S-10).
 * Server Component — 데이터 페칭 없이 클라이언트 경계(`ChainEditorPage`)만 배치한다.
 * 세션이 없으면 정확한 복귀 경로로 로그인 페이지 리다이렉트(E9). 비소유자 접근은
 * `GET /valuechains/:chainId/snapshots/latest`의 404 통일 정책(C-2)에 의해 걸러진다
 * (편집 캔버스 진입 후 "체인을 찾을 수 없음" 오류 화면으로 처리 — bootstrapError 분기).
 */
export default async function EditChainPage({ params }: EditChainPageProps) {
  const { chainId } = await params;
  const editPath = `/valuechains/${chainId}/edit`;

  const cookieStore = await cookies();
  const supabase = createSsrServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(editPath)}`);
  }

  return <ChainEditorPage mode="edit" variant="user" chainId={chainId} />;
}
