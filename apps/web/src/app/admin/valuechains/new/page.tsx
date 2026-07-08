import type { Metadata } from "next";
import { ChainEditorPage } from "@/features/valuechains/editor/components/ChainEditorPage";

export const metadata: Metadata = {
  title: "새 공식 밸류체인 만들기",
};

/**
 * 공식 밸류체인 신규 생성 라우트 셸(UC-021 plan 모듈 M18).
 * Server Component — 데이터 페칭 없이 클라이언트 경계(`ChainEditorPage`, variant='official')만 배치한다.
 * 화면 접근 가드는 `app/admin/layout.tsx`(UC-022 M2)가 담당한다(Precondition).
 * 인가의 진실은 API 서버측 검증(BR-1) — 이 페이지는 재검증하지 않는다.
 * 체인 상한 게이트는 공식 체인에 비적용(state 문서 §11 — create+official은 게이트 비활성화).
 */
export default function NewOfficialChainPage() {
  return <ChainEditorPage mode="create" variant="official" />;
}
