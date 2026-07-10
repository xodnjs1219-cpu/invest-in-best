"use client";

import Link from "next/link";
import type { UseQueryResult } from "@tanstack/react-query";
import { Badge, EmptyState, ErrorState, Heading, Skeleton } from "@/components/ui";
import {
  CHAINS_EMPTY_MESSAGE,
  CHAINS_FOCUS_TYPE_LABEL,
  CHAINS_OFFICIAL_BADGE_LABEL,
  CHAINS_SECTION_ERROR_MESSAGE,
  CHAINS_SUMMARY_PENDING_LABEL,
  CHAINS_USER_BADGE_LABEL,
  SECTION_RETRY_LABEL,
} from "@/features/companies/constants";
import type { CompanyValuechainsResponse } from "@/features/companies/lib/dto";
import { formatKrwCompactOrNull } from "@/lib/formatting/number";
import { ApiError } from "@/lib/http/api-client";

type BelongingChainsSectionProps = {
  query: UseQueryResult<CompanyValuechainsResponse, ApiError>;
};

/**
 * S5 소속 밸류체인 목록(UC-020 plan 모듈 21) — 로직 없는 Presenter. 노출 범위 분기 없음(서버 필터, E12).
 * 체인 행 클릭은 밸류체인 뷰(UC-009)로의 Link 이동뿐(라우팅 — Action 아님).
 */
export function BelongingChainsSection({ query }: BelongingChainsSectionProps) {
  if (query.isPending) {
    return <Skeleton data-testid="chains-loading" className="h-24" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message={CHAINS_SECTION_ERROR_MESSAGE}
        onRetry={() => query.refetch()}
        retryLabel={SECTION_RETRY_LABEL}
      />
    );
  }

  const { items } = query.data;

  return (
    <section className="flex flex-col gap-2">
      <Heading level={2}>소속 밸류체인</Heading>

      {items.length === 0 ? (
        <EmptyState message={CHAINS_EMPTY_MESSAGE} />
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.chainId}>
              <Link
                href={`/valuechains/${item.chainId}`}
                className="flex flex-col gap-1 rounded-[var(--radius)] border border-border px-3 py-2 text-sm hover:bg-surface-hover"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-fg">{item.name}</span>
                  <Badge tone="neutral">
                    {item.chainType === "official" ? CHAINS_OFFICIAL_BADGE_LABEL : CHAINS_USER_BADGE_LABEL}
                  </Badge>
                  <span className="text-xs text-fg-muted">{CHAINS_FOCUS_TYPE_LABEL[item.focusType]}</span>
                  <span className="text-xs text-fg-muted">노드 {item.nodeCount}개</span>
                </div>
                <div className="text-xs text-fg-muted">
                  {item.summary ? (
                    <span>
                      {formatKrwCompactOrNull(item.summary.totalMarketCapKrw, "-")} · 반영{" "}
                      {item.summary.coveredNodeCount}/{item.summary.totalNodeCount}
                    </span>
                  ) : (
                    <span>{CHAINS_SUMMARY_PENDING_LABEL}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
