import type { ReactNode } from "react";
import { Badge, Card } from "@/components/ui";
import {
  formatFocusLabel,
  formatMetricDisplay,
  formatNodeCount,
} from "@/features/valuechains/lib/cardPresentation";
import type { ChainCard as ChainCardType } from "@/features/valuechains/lib/dto";

type ChainCardProps = {
  card: ChainCardType;
  onSelect: (chainId: string) => void;
  /** UC-014/019: 삭제·복제 등 카드별 부가 액션(옵션) — 미전달 시 기존 렌더와 완전 동일. */
  actionSlot?: ReactNode;
};

/**
 * 체인 카드 Presenter (UC-007 plan 모듈 D-4) — 이름·기준·노드 수·가치총액(또는 미표시)·커버리지·
 * 이월 배지를 렌더링한다. 파생 계산은 전부 `cardPresentation.ts`에 위임한다(로직 없음).
 * 카드 전체 클릭은 제목 버튼의 스트레치드 오버레이(after:inset-0)가 담당한다 — 인터랙티브 요소
 * 중첩(nested-interactive) 없이 actionSlot(버튼)은 z-10 형제로 오버레이 위에 놓인다(UC-014/019).
 */
export function ChainCard({ card, onSelect, actionSlot }: ChainCardProps) {
  const focusLabel = formatFocusLabel(card.focusType, card.focusCompanyName);
  const metricDisplay = formatMetricDisplay(card.latestMetric);
  const nodeCountLabel = formatNodeCount(card.nodeCount);

  return (
    <Card interactive className="relative flex w-full flex-col gap-2 p-4 text-left">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelect(card.id)}
          className="truncate text-left text-base text-fg after:absolute after:inset-0 after:rounded-[var(--radius-lg)] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {card.name}
        </button>
        {actionSlot && <span className="relative z-10 shrink-0">{actionSlot}</span>}
      </div>
      <span className="text-sm text-fg-muted">{focusLabel}</span>
      <span className="text-sm text-fg-muted">{nodeCountLabel}</span>

      {metricDisplay.kind === "unavailable" ? (
        <span className="text-sm text-fg-subtle">집계 준비 중</span>
      ) : (
        <span className="flex flex-col gap-0.5">
          <span className="text-lg text-fg">{metricDisplay.text}</span>
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span>{metricDisplay.coverageText}</span>
            {metricDisplay.isCarriedForward && <Badge tone="warning">이월 집계</Badge>}
          </span>
        </span>
      )}
    </Card>
  );
}
