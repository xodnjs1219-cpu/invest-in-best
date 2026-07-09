"use client";

import Link from "next/link";
import { Badge, Button, Heading, Skeleton } from "@/components/ui";
import { CloneChainButton } from "@/features/valuechains/components/CloneChainButton";
import { DeleteChainButton } from "@/features/valuechains/components/DeleteChainButton";
import { useChainViewState } from "@/features/valuechains/context/chain-view-context";

/**
 * 체인 뷰 헤더 (plan 모듈 C6) — 브레드크럼 + 체인명 + 종류/기준 배지 + 그래프 규모 요약 + 액션.
 * UC-014: 공식 체인(chainType='official')일 때만 복제 버튼을 노출한다(BR-1).
 * UC-019: isOwner=true(본인 소유 사용자 체인)일 때만 삭제 버튼을 노출한다.
 */
export const ChainViewHeader = () => {
  const { chainId, structure, isOwner } = useChainViewState();

  if (structure.status !== "ready") {
    return (
      <header className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </header>
    );
  }

  const { chain } = structure.data;
  // 그래프 규모 요약 — DTO는 항상 배열이지만 방어적으로 기본값을 둔다.
  const nodeCount = structure.data.nodes?.length ?? 0;
  const edgeCount = structure.data.edges?.length ?? 0;
  const groupCount = structure.data.groups?.length ?? 0;
  const isOfficial = chain.chainType === "official";

  return (
    <header className="flex flex-col gap-4">
      {/* 브레드크럼 — 탐색으로 복귀 */}
      <Link
        href="/explore"
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <span aria-hidden>←</span> 탐색으로
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level={1}>{chain.name}</Heading>
            <Badge tone={isOfficial ? "accent" : "neutral"}>{isOfficial ? "공식" : "내 체인"}</Badge>
            <Badge tone="data">{chain.focusType === "company" ? "기업 중심" : "산업 중심"}</Badge>
          </div>

          {chain.focusType === "company" && chain.focusSecurity && (
            <p className="text-sm text-fg-muted">
              <span className="tabular">{chain.focusSecurity.ticker}</span> · {chain.focusSecurity.name}
            </p>
          )}

          {/* 그래프 규모 요약 — 노드·관계·그룹 수 */}
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
            <div className="flex items-center gap-1">
              <dt>노드</dt>
              <dd className="tabular font-semibold text-fg">{nodeCount}</dd>
            </div>
            <div className="flex items-center gap-1">
              <dt>관계</dt>
              <dd className="tabular font-semibold text-fg">{edgeCount}</dd>
            </div>
            {groupCount > 0 && (
              <div className="flex items-center gap-1">
                <dt>그룹</dt>
                <dd className="tabular font-semibold text-fg">{groupCount}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex items-center gap-2">
          {isOfficial && <CloneChainButton chainId={chainId} variant="header" />}
          {isOwner && (
            <>
              <Button as="link" variant="secondary" href={`/valuechains/${chainId}/edit`}>
                편집
              </Button>
              <DeleteChainButton
                chainId={chainId}
                chainName={chain.name}
                source="view"
                variant="header"
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
};
