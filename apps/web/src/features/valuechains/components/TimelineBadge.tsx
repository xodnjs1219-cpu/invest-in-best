"use client";

import { Button } from "@/components/ui";
import type { TimelineBadge as TimelineBadgeData } from "@/features/valuechains/context/chain-view-context";

export interface TimelineBadgeProps {
  badge: TimelineBadgeData;
  onReturnToLatest: () => void;
}

/** 스냅샷 기준 시각 표기 — `YYYY-MM-DD HH:mm` (초·"오전/오후" 없는 데이터 표기, §3 수치 규약). */
const formatSnapshotAt = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * 시점 조회 중 배지 (UC-012 plan 모듈 17) — 선택 날짜·기준 스냅샷 시각 표기 + "최신으로 돌아가기".
 */
export const TimelineBadge = ({ badge, onReturnToLatest }: TimelineBadgeProps) => (
  <div
    data-testid="timeline-badge"
    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] bg-accent-soft px-3 py-2 text-accent-soft-fg ring-1 ring-inset ring-accent/25"
  >
    <div className="flex flex-col gap-0.5 text-sm">
      <span>
        <span className="font-mono tabular">{badge.selectedDate}</span> 시점 조회 중
      </span>
      <span className="text-xs opacity-80">
        기준 스냅샷{" "}
        <span className="font-mono tabular">{formatSnapshotAt(badge.snapshotEffectiveAt)}</span>
      </span>
    </div>
    <Button variant="secondary" size="sm" onClick={onReturnToLatest}>
      최신으로 돌아가기
    </Button>
  </div>
);
