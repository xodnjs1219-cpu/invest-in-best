import type { Node, NodeProps } from "@xyflow/react";

export type GroupNodeData = {
  label: string;
  memberCount: number;
  /** 뷰(UC-009) 전용 — 접힘 상태. 편집(UC-017)에서는 미사용(접기 기능 없음). */
  isCollapsed?: boolean;
  /** 뷰(UC-009) 전용 — 접기/펼치기 토글. 미전달 시 토글 버튼 미렌더(편집 캔버스). */
  onToggleCollapse?: () => void;
  /** 편집(UC-017) 전용 — 멤버 0개 그룹(저장 시 스냅샷 제외 예고, C-1). */
  isEmpty?: boolean;
  /** 편집(UC-017) 전용 — 저장 422 오류 위치 하이라이트(clientGroupIds). */
  isHighlighted?: boolean;
};

export type GroupNodeType = Node<GroupNodeData>;

const EMPTY_BADGE_LABEL = "저장 시 제외";

/**
 * 그룹(클러스터) 노드 컴포넌트 (plan 모듈 A8·UC-017 M11) — 배경 영역 + 그룹 라벨.
 * 뷰(UC-009)/편집(UC-017) 공용 프레젠테이션 — `data`로만 렌더 분기(도메인 로직·dispatch 없음).
 * 뷰: 접힘 상태면 라벨 + "노드 n개" 요약만 표시(E4). 멤버 0개여도 라벨만 있는 빈 클러스터 렌더(C-1).
 * 편집: `isEmpty`(빈 그룹 — 점선 강조 + "저장 시 제외" 배지)·`isHighlighted`(오류 위치 표시)·
 * `selected`(React Flow 표준 prop — 선택 강조) 스타일 분기. 연결 핸들 없음(그룹은 엣지 대상 아님).
 */
export const GroupNode = ({ data, selected }: NodeProps<GroupNodeType>) => {
  const isEmpty = data.isEmpty ?? false;
  const isHighlighted = data.isHighlighted ?? false;

  const borderClass = isHighlighted
    ? "border-red-400 bg-red-50/40"
    : isEmpty
      ? "border-indigo-300 bg-indigo-50/20"
      : "border-indigo-200 bg-indigo-50/40";
  const selectedClass = selected ? "ring-2 ring-indigo-400" : "";

  return (
    <div
      data-testid="group-node"
      data-empty={isEmpty || undefined}
      data-highlighted={isHighlighted || undefined}
      className={`h-full w-full rounded-xl border-2 border-dashed p-2 ${borderClass} ${selectedClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-indigo-700">{data.label}</span>
        {data.onToggleCollapse && (
          <button
            type="button"
            onClick={data.onToggleCollapse}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100"
            aria-label={data.isCollapsed ? "그룹 펼치기" : "그룹 접기"}
          >
            {data.isCollapsed ? "펼치기" : "접기"}
          </button>
        )}
        {isEmpty && (
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500">
            {EMPTY_BADGE_LABEL}
          </span>
        )}
      </div>
      {data.isCollapsed && (
        <div className="mt-1 text-[11px] text-indigo-500">노드 {data.memberCount}개</div>
      )}
    </div>
  );
};
