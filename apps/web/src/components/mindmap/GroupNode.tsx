import type { Node, NodeProps } from "@xyflow/react";

export type GroupNodeData = {
  label: string;
  isCollapsed: boolean;
  memberCount: number;
  onToggleCollapse: () => void;
};

export type GroupNodeType = Node<GroupNodeData>;

/**
 * 그룹(클러스터) 노드 컴포넌트 (plan 모듈 A8) — 배경 영역 + 그룹 라벨.
 * 접힘 상태면 라벨 + "노드 n개" 요약만 표시(E4). 멤버 0개여도 라벨만 있는 빈 클러스터 렌더(C-1).
 * 접기/펼치기 토글 버튼(`onToggleCollapse` prop) — props 콜백만 사용, 로직 없음.
 */
export const GroupNode = ({ data }: NodeProps<GroupNodeType>) => {
  return (
    <div className="h-full w-full rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-indigo-700">{data.label}</span>
        <button
          type="button"
          onClick={data.onToggleCollapse}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100"
          aria-label={data.isCollapsed ? "그룹 펼치기" : "그룹 접기"}
        >
          {data.isCollapsed ? "펼치기" : "접기"}
        </button>
      </div>
      {data.isCollapsed && (
        <div className="mt-1 text-[11px] text-indigo-500">노드 {data.memberCount}개</div>
      )}
    </div>
  );
};
