"use client";

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
      <div
        data-testid="admin-chain-table-skeleton"
        className="h-64 w-full animate-pulse rounded-lg bg-gray-100"
      />
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center">
        <p className="text-sm text-red-700">{ADMIN_CHAIN_LIST_TEXT.loadErrorTitle}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          {ADMIN_CHAIN_LIST_TEXT.retryAction}
        </button>
      </div>
    );
  }

  if (chains.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 px-4 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">{ADMIN_CHAIN_LIST_TEXT.emptyStateTitle}</p>
        <p className="text-sm text-gray-500">{ADMIN_CHAIN_LIST_TEXT.emptyStateDescription}</p>
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          <th className="py-2 pr-4">이름</th>
          <th className="py-2 pr-4">기준</th>
          <th className="py-2 pr-4">노드 수</th>
          <th className="py-2 pr-4">최근 변경</th>
          <th className="py-2 pr-4">상태</th>
          <th className="py-2 pr-4">작업</th>
        </tr>
      </thead>
      <tbody>
        {chains.map((chain) => (
          <tr key={chain.chainId} className="border-b border-gray-100">
            <td className="py-2 pr-4 font-medium text-gray-900">{chain.name}</td>
            <td className="py-2 pr-4">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{FOCUS_TYPE_LABELS[chain.focusType]}</span>
            </td>
            <td className="py-2 pr-4">{chain.latestSnapshot?.nodeCount ?? 0}</td>
            <td className="py-2 pr-4 text-gray-500">
              {chain.latestSnapshot ? (
                <>
                  {new Date(chain.latestSnapshot.effectiveAt).toLocaleString("ko-KR")} ·{" "}
                  {CHANGE_SOURCE_LABELS[chain.latestSnapshot.changeSource]}
                </>
              ) : (
                "-"
              )}
            </td>
            <td className="py-2 pr-4">
              {chain.isArchived && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {ADMIN_CHAIN_LIST_TEXT.archivedBadge}
                </span>
              )}
            </td>
            <td className="py-2 pr-4">
              {!chain.isArchived && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(chain.chainId)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {ADMIN_CHAIN_LIST_TEXT.editAction}
                  </button>
                  <button
                    type="button"
                    disabled={archivingChainId === chain.chainId}
                    onClick={() => onArchiveClick(chain)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {ADMIN_CHAIN_LIST_TEXT.archiveAction}
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
