"use client";

import type { TimelineBadge as TimelineBadgeData } from "@/features/valuechains/context/chain-view-context";

export interface TimelineBadgeProps {
  badge: TimelineBadgeData;
  onReturnToLatest: () => void;
}

/**
 * 시점 조회 중 배지 (UC-012 plan 모듈 17) — 선택 날짜·기준 스냅샷 시각 표기 + "최신으로 돌아가기".
 */
export const TimelineBadge = ({ badge, onReturnToLatest }: TimelineBadgeProps) => (
  <div
    data-testid="timeline-badge"
    className="flex flex-wrap items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200"
  >
    <span>
      {badge.selectedDate} 시점 조회 중 · 기준 스냅샷 {new Date(badge.snapshotEffectiveAt).toLocaleString("ko-KR")}
    </span>
    <button
      type="button"
      onClick={onReturnToLatest}
      className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-200"
    >
      최신으로 돌아가기
    </button>
  </div>
);
