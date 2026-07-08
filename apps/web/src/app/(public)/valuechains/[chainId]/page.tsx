import { ChainViewHeader } from "@/features/valuechains/components/ChainViewHeader";
import { DataSourceFooter } from "@/features/valuechains/components/DataSourceFooter";
import { MindmapCanvas } from "@/features/valuechains/components/MindmapCanvas";
import { ChainViewProvider } from "@/features/valuechains/context/ChainViewProvider";

type PageProps = {
  params: Promise<{ chainId: string }>;
  searchParams: Promise<{ at?: string }>;
};

/**
 * 밸류체인 뷰 페이지 셸 (plan 모듈 C7) — Server Component: params/searchParams 해석만 하고
 * Provider에 위임한다. `at`은 state_management §9 계약대로 Provider에 전달하지만, UC-009 단계
 * Provider는 C5의 `?at=` 배선 규칙에 따라 이를 무시(S1=null 고정)하므로 유효한 과거 날짜
 * 딥링크도 최신 구조를 표시한다(시점 복원은 UC-012에서 활성화).
 *
 * `NodeInfoPanel`(UC-011)·`DashboardPanel`(UC-010)·`TimelinePanel`(UC-012)은 각 plan에서
 * 이 트리에 추가한다(state_management.md §9 컴포넌트 트리 순서 유지).
 */
export default async function ValuechainViewPage({ params, searchParams }: PageProps) {
  const { chainId } = await params;
  const { at } = await searchParams;

  return (
    <ChainViewProvider chainId={chainId} atParam={at ?? null}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ChainViewHeader />
        <MindmapCanvas />
        <DataSourceFooter />
      </div>
    </ChainViewProvider>
  );
}
