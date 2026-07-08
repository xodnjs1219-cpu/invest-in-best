import {
  formatFocusLabel,
  formatMetricDisplay,
  formatNodeCount,
} from "@/features/valuechains/lib/cardPresentation";
import type { ChainCard as ChainCardType } from "@/features/valuechains/lib/dto";

type ChainCardProps = {
  card: ChainCardType;
  onSelect: (chainId: string) => void;
};

/**
 * 체인 카드 Presenter (UC-007 plan 모듈 D-4) — 이름·기준·노드 수·가치총액(또는 미표시)·커버리지·
 * 이월 배지를 렌더링한다. 파생 계산은 전부 `cardPresentation.ts`에 위임한다(로직 없음).
 */
export function ChainCard({ card, onSelect }: ChainCardProps) {
  const focusLabel = formatFocusLabel(card.focusType, card.focusCompanyName);
  const metricDisplay = formatMetricDisplay(card.latestMetric);
  const nodeCountLabel = formatNodeCount(card.nodeCount);

  return (
    <button
      type="button"
      onClick={() => onSelect(card.id)}
      className="flex w-full flex-col gap-2 rounded-lg border border-gray-200 p-4 text-left transition hover:border-blue-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span className="truncate text-base font-semibold text-gray-900">{card.name}</span>
      <span className="text-sm text-gray-500">{focusLabel}</span>
      <span className="text-sm text-gray-500">{nodeCountLabel}</span>

      {metricDisplay.kind === "unavailable" ? (
        <span className="text-sm text-gray-400">집계 준비 중</span>
      ) : (
        <span className="flex flex-col gap-0.5">
          <span className="text-lg font-bold text-gray-900">{metricDisplay.text}</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>{metricDisplay.coverageText}</span>
            {metricDisplay.isCarriedForward && (
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                이월 집계
              </span>
            )}
          </span>
        </span>
      )}
    </button>
  );
}
