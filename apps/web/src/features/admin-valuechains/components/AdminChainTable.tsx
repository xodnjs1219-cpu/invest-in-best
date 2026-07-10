"use client";

import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import type { AdminChainListItem } from "@/features/admin-valuechains/backend/schema";
import {
  ADMIN_CHAIN_LIST_TEXT,
  CHANGE_SOURCE_LABELS,
  FOCUS_TYPE_LABELS,
} from "@/features/admin-valuechains/constants";

export interface AdminChainTableProps {
  chains: AdminChainListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  archivingChainId: string | null;
  onEdit: (chainId: string) => void;
  onArchiveClick: (chain: AdminChainListItem) => void;
}

/**
 * 어드민 공식 체인 목록 테이블(UC-021 plan 모듈 M15) — 순수 Presenter.
 * 로딩 스켈레톤/오류(재시도)/빈 상태(생성 유도)/정상 목록 분기.
 * 보관 행은 편집/보관 버튼 미노출(R-6 — 배지만).
 */
export function AdminChainTable({
  chains,
  isLoading,
  isError,
  onRetry,
  archivingChainId,
  onEdit,
  onArchiveClick,
}: AdminChainTableProps) {
  if (isLoading) {
    return (
      <div data-testid="admin-chain-table-skeleton">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={ADMIN_CHAIN_LIST_TEXT.loadErrorTitle}
        onRetry={onRetry}
        retryLabel={ADMIN_CHAIN_LIST_TEXT.retryAction}
      />
    );
  }

  if (chains.length === 0) {
    return (
      <EmptyState message={ADMIN_CHAIN_LIST_TEXT.emptyStateTitle}>
        <p className="text-sm text-fg-muted">{ADMIN_CHAIN_LIST_TEXT.emptyStateDescription}</p>
      </EmptyState>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-fg-muted">
          <th className="p-2">이름</th>
          <th className="p-2">기준</th>
          <th className="p-2">노드 수</th>
          <th className="p-2">최근 변경</th>
          <th className="p-2">상태</th>
          <th className="p-2">작업</th>
        </tr>
      </thead>
      <tbody>
        {chains.map((chain) => (
          <tr key={chain.chainId} className="border-b border-border">
            <td className="p-2 text-fg">{chain.name}</td>
            <td className="p-2">
              <Badge tone="neutral">{FOCUS_TYPE_LABELS[chain.focusType]}</Badge>
            </td>
            <td className="p-2">{chain.latestSnapshot?.nodeCount ?? 0}</td>
            <td className="p-2 text-fg-muted">
              {chain.latestSnapshot ? (
                <>
                  {new Date(chain.latestSnapshot.effectiveAt).toLocaleString("ko-KR")} ·{" "}
                  {CHANGE_SOURCE_LABELS[chain.latestSnapshot.changeSource]}
                </>
              ) : (
                "-"
              )}
            </td>
            <td className="p-2">
              {chain.isArchived && (
                <Badge tone="warning">{ADMIN_CHAIN_LIST_TEXT.archivedBadge}</Badge>
              )}
            </td>
            <td className="p-2">
              {!chain.isArchived && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onEdit(chain.chainId)}>
                    {ADMIN_CHAIN_LIST_TEXT.editAction}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={archivingChainId === chain.chainId}
                    onClick={() => onArchiveClick(chain)}
                  >
                    {ADMIN_CHAIN_LIST_TEXT.archiveAction}
                  </Button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
