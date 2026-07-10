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
  /** 그룹 배열 인덱스 — 4색 순환 tone(DESIGN.md §2 그룹 팔레트). 미전달 시 0. */
  tone?: number;
};

export type GroupNodeType = Node<GroupNodeData>;

const EMPTY_BADGE_LABEL = "저장 시 제외";

/** 그룹 tone 4색 순환(§2) — chart-series 계보. 정적 클래스 배열(JIT 퍼지 안전). */
const GROUP_TONES = [
  {
    border: "border-mm-group-1/40",
    fill: "bg-mm-group-1-soft/60",
    fillEmpty: "bg-mm-group-1-soft/40",
    text: "text-mm-group-1-fg",
  },
  {
    border: "border-mm-group-2/40",
    fill: "bg-mm-group-2-soft/60",
    fillEmpty: "bg-mm-group-2-soft/40",
    text: "text-mm-group-2-fg",
  },
  {
    border: "border-mm-group-3/40",
    fill: "bg-mm-group-3-soft/60",
    fillEmpty: "bg-mm-group-3-soft/40",
    text: "text-mm-group-3-fg",
  },
  {
    border: "border-mm-group-4/40",
    fill: "bg-mm-group-4-soft/60",
    fillEmpty: "bg-mm-group-4-soft/40",
    text: "text-mm-group-4-fg",
  },
] as const;

/**
 * 그룹(클러스터) 노드 컴포넌트 (plan 모듈 A8·UC-017 M11) — 배경 영역 + 그룹 라벨.
 * 뷰(UC-009)/편집(UC-017) 공용 프레젠테이션 — `data`로만 렌더 분기(도메인 로직·dispatch 없음).
 * 뷰: 접힘 상태면 라벨 + "노드 n개" 요약만 표시(E4). 멤버 0개여도 라벨만 있는 빈 클러스터 렌더(C-1).
 * 편집: `isEmpty`(빈 그룹 — 점선 강조 + "저장 시 제외" 배지)·`isHighlighted`(오류 위치 표시)·
 * `selected`(React Flow 표준 prop — 선택 강조) 스타일 분기. 연결 핸들 없음(그룹은 엣지 대상 아님).
 * 색은 그룹 인덱스 기반 4색 순환(tone) — 422 하이라이트(danger)는 tone보다 우선한다.
 */
export const GroupNode = ({ data, selected }: NodeProps<GroupNodeType>) => {
  const isEmpty = data.isEmpty ?? false;
  const isHighlighted = data.isHighlighted ?? false;
  const toneIndex = (data.tone ?? 0) % GROUP_TONES.length;
  const tone = GROUP_TONES[toneIndex];

  const isCircle = data.shape === "circle";
  const chromeClass = isHighlighted
    ? "border-danger/50 bg-danger-soft/50"
    : isEmpty
      ? `${tone.border} ${tone.fillEmpty}`
      : `${tone.border} ${tone.fill}`;
  const selectedClass = selected ? "ring-2 ring-ring" : "";
  // 원형 클러스터는 rounded-full로 타원/원형 영역을 만든다(bounds가 정사각이면 정원).
  // 둥근 모서리에 라벨이 잘리지 않도록, 원형에서는 라벨을 상단 중앙에 배치한다.
  const shapeClass = isCircle ? "rounded-full" : "rounded-xl";

  return (
    <div
      data-testid="group-node"
      data-empty={isEmpty || undefined}
      data-highlighted={isHighlighted || undefined}
      data-tone={toneIndex}
      className={`h-full w-full border border-dashed p-2 ${shapeClass} ${chromeClass} ${selectedClass}`}
    >
      {/* 원형(타원) 모드는 상단 곡선이 좁아 라벨을 안쪽(더 넓은 지점)으로 내리고 중앙 정렬한다. */}
      <div
        className={`flex items-center gap-2 ${isCircle ? "justify-center px-6 pt-4" : "justify-between"}`}
      >
        <span className={`truncate text-xs ${tone.text}`}>{data.label}</span>
        {data.onToggleCollapse && (
          <button
            type="button"
            onClick={data.onToggleCollapse}
            className={`rounded-sm px-1.5 py-0.5 text-xs ${tone.text} hover:bg-surface-raised/60`}
            aria-label={data.isCollapsed ? "그룹 펼치기" : "그룹 접기"}
          >
            {data.isCollapsed ? "펼치기" : "접기"}
          </button>
        )}
        {isEmpty && (
          <span
            className={`rounded-sm bg-surface-raised/80 px-1.5 py-0.5 text-[10px] ${tone.text} ring-1 ring-inset ring-border`}
          >
            {EMPTY_BADGE_LABEL}
          </span>
        )}
      </div>
      {data.isCollapsed && (
        <div className={`mt-1 text-xs ${tone.text}`}>노드 {data.memberCount}개</div>
      )}
    </div>
  );
};
