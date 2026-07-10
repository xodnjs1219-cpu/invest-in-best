import { type Node, type NodeProps } from "@xyflow/react";
import { LISTING_STATUS_LABELS } from "@iib/domain";
import { NodeDeleteButton } from "@/components/mindmap/NodeDeleteButton";
import { NodeHandles } from "@/components/mindmap/NodeHandles";
import type { ListingStatus, MarketCode, NodeShape } from "@/components/mindmap/types";

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
  /** 뷰어 노드 모양 — "circle"이면 종목명만 담은 원형으로 렌더(옵시디언 그래프뷰식). 기본 "box". */
  shape?: NodeShape;
};

export type CompanyNodeType = Node<CompanyNodeData>;

/** hover 강조/흐림 + 진입 애니메이션 래퍼 클래스(노드 공용). */
export function nodeStateClass(data: { isEmphasized?: boolean; isDimmed?: boolean }): string {
  const state = data.isEmphasized ? "mm-highlighted" : data.isDimmed ? "mm-dimmed" : "";
  return `mm-node-enter ${state}`;
}

/**
 * 노드 섀시 상태 클래스(노드 공용, DESIGN.md §4 캔버스 규약) — 명도 위계.
 * 기본은 뉴트럴 헤어라인·그림자 없음, accent·그림자는 상태 신호로만 승격한다.
 * cn()은 충돌 해소를 안 하므로 border-color 계열은 반드시 한 갈래만 반환한다.
 */
export function nodeChromeClass(
  data: { isEmphasized?: boolean },
  selected?: boolean,
): string {
  if (selected) return "border-border-strong ring-2 ring-ring";
  if (data.isEmphasized) return "border-accent shadow-ambient";
  return "border-border-strong";
}

/**
 * 상장기업 노드 컴포넌트 (plan 모듈 A8) — 티커·종목명·시장 배지 표시.
 * `listingStatus !== 'listed'`면 상장폐지/거래정지 배지 추가(E10). props 콜백만 사용, 로직 없음.
 * `data.onDelete`가 있으면(편집 캔버스) 우상단 삭제 버튼을 노출한다.
 */
export const CompanyNode = ({ id, data, isConnectable, selected }: NodeProps<CompanyNodeType>) => {
  const showStatusBadge = data.listingStatus && data.listingStatus !== "listed";

  // 시장별 배지 색: KRX=data(cyan), US=accent(violet). SecurityBadges의 MarketBadge와 동일한 시각 언어.
  const marketBadgeClass =
    data.market === "US"
      ? "bg-accent-soft text-accent-soft-fg"
      : "bg-data-soft text-data";

  // 원형 표시(옵시디언 그래프뷰식) — 종목명만 담고, 핸들·삭제버튼·강조/dim은 카드형과 동일하게 지원한다.
  if (data.shape === "circle") {
    return (
      <div
        data-animate-landing
        data-selected={selected || undefined}
        className={`group relative flex aspect-square h-[92px] w-[92px] items-center justify-center rounded-full border bg-surface-raised text-center transition-[border-color,box-shadow] ${nodeChromeClass(data, selected)} ${nodeStateClass(data)}`}
      >
        {data.onDelete && (
          <NodeDeleteButton onDelete={() => data.onDelete?.(id)} label={`${data.label} 노드 삭제`} />
        )}
        {/* 원형 표시에서는 상하좌우 연결점을 감춘다(엣지는 노드 경계로 자동 연결되어 그대로 렌더). */}
        <NodeHandles isConnectable={isConnectable} hidden />
        <span className="line-clamp-3 px-2.5 text-[13px] leading-tight text-fg break-keep">
          {data.label}
        </span>
      </div>
    );
  }

  return (
    <div
      data-animate-landing
      data-selected={selected || undefined}
      className={`group relative min-w-[140px] rounded-[var(--radius-lg)] border bg-surface-raised px-4 py-2 transition-[border-color,box-shadow] ${nodeChromeClass(data, selected)} ${nodeStateClass(data)}`}
    >
      {data.onDelete && (
        <NodeDeleteButton onDelete={() => data.onDelete?.(id)} label={`${data.label} 노드 삭제`} />
      )}
      <NodeHandles isConnectable={isConnectable} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-fg">{data.label}</span>
        {showStatusBadge && data.listingStatus && (
          <span className="rounded-sm bg-danger-soft px-1.5 py-0.5 text-[10px] text-danger">
            {LISTING_STATUS_LABELS[data.listingStatus]}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted">
        {data.sublabel && <span>{data.sublabel}</span>}
        {data.market && (
          <span className={`rounded-sm px-1.5 py-0.5 text-[10px] ${marketBadgeClass}`}>
            {data.market}
          </span>
        )}
      </div>
    </div>
  );
};
