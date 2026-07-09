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
 * 최상위는 `role="button"`(div)이다 — `actionSlot`(버튼)을 내부에 배치해도 HTML 중첩 버튼 위반이
 * 발생하지 않도록 카드 전체 클릭과 액션 슬롯 클릭을 형제 요소로 분리한다(UC-014/019).
 */
export function ChainCard({ card, onSelect, actionSlot }: ChainCardProps) {
  const focusLabel = formatFocusLabel(card.focusType, card.focusCompanyName);
  const metricDisplay = formatMetricDisplay(card.latestMetric);
  const nodeCountLabel = formatNodeCount(card.nodeCount);

  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      onClick={() => onSelect(card.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(card.id);
        }
      }}
      className="flex w-full flex-col gap-2 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-base font-semibold text-fg">{card.name}</span>
        {actionSlot && (
          <span onClick={(event) => event.stopPropagation()} className="shrink-0">
            {actionSlot}
          </span>
        )}
      </div>
      <span className="text-sm text-fg-muted">{focusLabel}</span>
      <span className="text-sm text-fg-muted">{nodeCountLabel}</span>

      {metricDisplay.kind === "unavailable" ? (
        <span className="text-sm text-fg-subtle">집계 준비 중</span>
      ) : (
        <span className="flex flex-col gap-0.5">
          <span className="text-lg font-bold text-fg">{metricDisplay.text}</span>
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span>{metricDisplay.coverageText}</span>
            {metricDisplay.isCarriedForward && <Badge tone="warning">이월 집계</Badge>}
          </span>
        </span>
      )}
    </Card>
  );
}
