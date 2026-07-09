import { type Node, type NodeProps } from "@xyflow/react";
import { LISTING_STATUS_LABELS } from "@iib/domain";
import { NodeDeleteButton } from "@/components/mindmap/NodeDeleteButton";
import { NodeHandles } from "@/components/mindmap/NodeHandles";
import type { ListingStatus, MarketCode } from "@/components/mindmap/types";

export type CompanyNodeData = {
  label: string;
  sublabel?: string;
  market?: MarketCode;
  listingStatus?: ListingStatus;
  /** 편집 캔버스에서만 주입 — 있으면 우상단에 삭제(×) 버튼을 렌더한다. */
  onDelete?: (nodeId: string) => void;
  /** 옵시디언식 hover — 강조/흐림(캔버스가 주입). */
  isEmphasized?: boolean;
  isDimmed?: boolean;
};

export type CompanyNodeType = Node<CompanyNodeData>;

/** hover 강조/흐림 + 진입 애니메이션 래퍼 클래스(노드 공용). */
export function nodeStateClass(data: { isEmphasized?: boolean; isDimmed?: boolean }): string {
  const state = data.isEmphasized ? "mm-highlighted" : data.isDimmed ? "mm-dimmed" : "";
  return `mm-node-enter ${state}`;
}

/**
 * 상장기업 노드 컴포넌트 (plan 모듈 A8) — 티커·종목명·시장 배지 표시.
 * `listingStatus !== 'listed'`면 상장폐지/거래정지 배지 추가(E10). props 콜백만 사용, 로직 없음.
 * `data.onDelete`가 있으면(편집 캔버스) 우상단 삭제 버튼을 노출한다.
 */
export const CompanyNode = ({ id, data, isConnectable }: NodeProps<CompanyNodeType>) => {
  const showStatusBadge = data.listingStatus && data.listingStatus !== "listed";

  // 시장별 배지 색: KRX=data(cyan), US=accent(violet). SecurityBadges의 MarketBadge와 동일한 시각 언어.
  const marketBadgeClass =
    data.market === "US"
      ? "bg-accent-soft text-accent-soft-fg"
      : "bg-data-soft text-data";

  return (
    <div
      data-animate-landing
      className={`group relative min-w-[140px] rounded-[var(--radius-lg)] border-2 border-accent/40 bg-surface-raised px-4 py-2 shadow-[var(--shadow-sm)] ${nodeStateClass(data)}`}
    >
      {data.onDelete && (
        <NodeDeleteButton onDelete={() => data.onDelete?.(id)} label={`${data.label} 노드 삭제`} />
      )}
      <NodeHandles isConnectable={isConnectable} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg">{data.label}</span>
        {showStatusBadge && data.listingStatus && (
          <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">
            {LISTING_STATUS_LABELS[data.listingStatus]}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted">
        {data.sublabel && <span>{data.sublabel}</span>}
        {data.market && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${marketBadgeClass}`}
          >
            {data.market}
          </span>
        )}
      </div>
    </div>
  );
};
