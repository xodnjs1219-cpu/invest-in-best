import type { Metadata } from "next";
import { ChainViewHeader } from "@/features/valuechains/components/ChainViewHeader";
import { DataSourceFooter } from "@/features/valuechains/components/DataSourceFooter";
import { MindmapCanvas } from "@/features/valuechains/components/MindmapCanvas";
import { NodeInfoPanel } from "@/features/valuechains/components/NodeInfoPanel";
import { DashboardPanel } from "@/features/valuechains/components/DashboardPanel";
import { TimelinePanel } from "@/features/valuechains/components/TimelinePanel";
import { ChainViewProvider } from "@/features/valuechains/context/ChainViewProvider";
import { createServiceClient } from "@/lib/supabase/service-client";

type PageProps = {
  params: Promise<{ chainId: string }>;
  searchParams: Promise<{ at?: string }>;
};

/**
 * 밸류체인 뷰 메타데이터 — 공식·비보관 체인만 인덱싱 대상으로 삼는다.
 * 조회 실패·사용자 체인·보관 체인은 noindex로 처리해 비공개 콘텐츠가 색인되지 않게 한다.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { chainId } = await params;

  let chain: { name: string; chain_type: string; is_archived: boolean } | null = null;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("value_chains")
      .select("name, chain_type, is_archived")
      .eq("id", chainId)
      .maybeSingle();
    chain = data;
  } catch {
    // 조회 실패 시 아래 폴백(noindex)로 처리.
  }

  const isPublic = chain?.chain_type === "official" && chain.is_archived === false;

  if (!isPublic) {
    return {
      title: "밸류체인",
      robots: { index: false, follow: false },
    };
  }

  const title = `${chain!.name} — 밸류체인`;
  const description = `${chain!.name} 밸류체인을 마인드맵으로 탐색하고 가치총액·구성 기업 현황을 대시보드로 확인하세요.`;
  const canonical = `/valuechains/${chainId}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
    },
    twitter: {
      title,
      description,
    },
  };
}

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
