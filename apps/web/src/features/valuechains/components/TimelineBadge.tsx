"use client";

import { Button } from "@/components/ui";
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
    className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] bg-accent-soft px-3 py-2 text-sm text-accent-soft-fg ring-1 ring-inset ring-accent/25"
  >
    <span>
      {badge.selectedDate} 시점 조회 중 · 기준 스냅샷 {new Date(badge.snapshotEffectiveAt).toLocaleString("ko-KR")}
    </span>
    <Button variant="secondary" size="sm" onClick={onReturnToLatest}>
      최신으로 돌아가기
    </Button>
  </div>
);
