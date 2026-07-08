import { ChainViewHeader } from "@/features/valuechains/components/ChainViewHeader";
import { DataSourceFooter } from "@/features/valuechains/components/DataSourceFooter";
import { MindmapCanvas } from "@/features/valuechains/components/MindmapCanvas";
import { NodeInfoPanel } from "@/features/valuechains/components/NodeInfoPanel";
import { DashboardPanel } from "@/features/valuechains/components/DashboardPanel";
import { TimelinePanel } from "@/features/valuechains/components/TimelinePanel";
import { ChainViewProvider } from "@/features/valuechains/context/ChainViewProvider";

type PageProps = {
  params: Promise<{ chainId: string }>;
  searchParams: Promise<{ at?: string }>;
};

/**
 * 밸류체인 뷰 페이지 셸 (plan 모듈 C7) — Server Component: params/searchParams 해석만 하고
 * Provider에 위임한다. `at`은 state_management §9 계약대로 Provider에 전달되며, UC-012에서
 * `?at=` 배선(S1 초기화 + snapshot-at 쿼리 활성화)이 함께 활성화되어 유효한 과거 날짜
 * 딥링크가 해당 시점 구조를 정상 복원한다.
 *
 * 컴포넌트 트리 순서(state_management.md §9): Header → MindmapCanvas → NodeInfoPanel →
 * DashboardPanel → TimelinePanel → DataSourceFooter.
 */
export default async function ValuechainViewPage({ params, searchParams }: PageProps) {
  const { chainId } = await params;
  const { at } = await searchParams;

  return (
    <ChainViewProvider chainId={chainId} atParam={at ?? null}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ChainViewHeader />
        <MindmapCanvas />
        <NodeInfoPanel />
        <DashboardPanel />
        <TimelinePanel />
        <DataSourceFooter />
      </div>
    </ChainViewProvider>
  );
}
