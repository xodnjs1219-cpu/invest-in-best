import type { Node, NodeProps } from "@xyflow/react";
import type { NodeShape } from "@/components/mindmap/types";

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
  /** 뷰어 노드 모양 — "circle"이면 클러스터도 원형(타원)으로 표시. 기본 "box"(둥근 사각형). */
  shape?: NodeShape;
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

  const isCircle = data.shape === "circle";
  const borderClass = isHighlighted
    ? "border-danger/50 bg-danger-soft/50"
    : isEmpty
      ? "border-accent/40 bg-accent-soft/40"
      : "border-accent/30 bg-accent-soft/60";
  const selectedClass = selected ? (isCircle ? "ring-2 ring-accent/50" : "ring-2 ring-accent/50") : "";
  // 원형 클러스터는 rounded-full로 타원/원형 영역을 만든다(bounds가 정사각이면 정원).
  // 둥근 모서리에 라벨이 잘리지 않도록, 원형에서는 라벨을 상단 중앙에 배치한다.
  const shapeClass = isCircle ? "rounded-full" : "rounded-xl";

  return (
    <div
      data-testid="group-node"
      data-empty={isEmpty || undefined}
      data-highlighted={isHighlighted || undefined}
      className={`h-full w-full border-2 border-dashed p-2 ${shapeClass} ${borderClass} ${selectedClass}`}
    >
      <div
        className={`flex items-center gap-2 ${isCircle ? "justify-center" : "justify-between"}`}
      >
        <span className="truncate text-xs text-accent-soft-fg">{data.label}</span>
        {data.onToggleCollapse && (
          <button
            type="button"
            onClick={data.onToggleCollapse}
            className="rounded px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent-soft"
            aria-label={data.isCollapsed ? "그룹 펼치기" : "그룹 접기"}
          >
            {data.isCollapsed ? "펼치기" : "접기"}
          </button>
        )}
        {isEmpty && (
          <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent-soft-fg ring-1 ring-inset ring-accent/25">
            {EMPTY_BADGE_LABEL}
          </span>
        )}
      </div>
      {data.isCollapsed && (
        <div className="mt-1 text-[11px] text-accent-soft-fg">노드 {data.memberCount}개</div>
      )}
    </div>
  );
};
