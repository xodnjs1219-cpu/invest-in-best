import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { LISTING_STATUS_LABELS } from "@iib/domain";
import type { ListingStatus, MarketCode } from "@/components/mindmap/types";

export type CompanyNodeData = {
  label: string;
  sublabel?: string;
  market?: MarketCode;
  listingStatus?: ListingStatus;
};

export type CompanyNodeType = Node<CompanyNodeData>;

/**
 * 상장기업 노드 컴포넌트 (plan 모듈 A8) — 티커·종목명·시장 배지 표시.
 * `listingStatus !== 'listed'`면 상장폐지/거래정지 배지 추가(E10). props 콜백만 사용, 로직 없음.
 */
export const CompanyNode = ({ data, isConnectable }: NodeProps<CompanyNodeType>) => {
  const showStatusBadge = data.listingStatus && data.listingStatus !== "listed";

  return (
    <div className="rounded-lg border-2 border-blue-300 bg-white px-4 py-2 shadow-sm min-w-[140px]">
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-gray-900">{data.label}</span>
        {showStatusBadge && data.listingStatus && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
            {LISTING_STATUS_LABELS[data.listingStatus]}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
        {data.sublabel && <span>{data.sublabel}</span>}
        {data.market && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
            {data.market}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  );
};
