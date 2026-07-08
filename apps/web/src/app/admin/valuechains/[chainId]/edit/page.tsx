import type { Metadata } from "next";
import { ChainEditorPage } from "@/features/valuechains/editor/components/ChainEditorPage";

export const metadata: Metadata = {
  title: "공식 밸류체인 편집",
};

interface EditOfficialChainPageProps {
  params: Promise<{ chainId: string }>;
}

/**
 * 공식 밸류체인 편집 진입 라우트 셸(UC-021 plan 모듈 M18).
 * Server Component — 데이터 페칭 없이 클라이언트 경계(`ChainEditorPage`, variant='official')만 배치한다.
 * 화면 접근 가드는 `app/admin/layout.tsx`(UC-022 M2)가 담당한다. 인가의 진실은
 * `GET /valuechains/:chainId/snapshots/latest`의 Admin 권한 검증(BR-1, UC-016 M12) —
 * 비Admin 직접 접근은 403으로 최종 차단되며 bootstrapError 분기로 표시된다.
 */
export default async function EditOfficialChainPage({ params }: EditOfficialChainPageProps) {
  const { chainId } = await params;
  return <ChainEditorPage mode="edit" variant="official" chainId={chainId} />;
}
