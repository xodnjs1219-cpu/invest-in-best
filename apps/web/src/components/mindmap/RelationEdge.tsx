import { BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType, type Edge, type EdgeProps } from "@xyflow/react";

export type RelationEdgeData = {
  label: string;
  isDirected: boolean;
  /** 422 저장 오류로 위반 판정된 엣지 하이라이트(UC-016 spec API-3). */
  isHighlighted?: boolean;
  /** 관계 종류 마스터가 비활성(is_active=false)인 기존 엣지 시각 구분(BR-4/E4). */
  isInactiveType?: boolean;
};

export type RelationEdgeType = Edge<RelationEdgeData>;

const DEFAULT_STROKE = "#94a3b8";
const HIGHLIGHT_STROKE = "#dc2626";
const INACTIVE_DASH = "4 4";

/**
 * 관계 엣지 컴포넌트 (plan 모듈 A8/M22, BR-4~BR-6) — 관계 라벨 표시.
 * `isDirected`가 true면 target 방향 화살표(markerEnd), false면 화살표 없음.
 * `isHighlighted`(422 오류 위치)·`isInactiveType`(비활성 종류)은 시각 구분 스타일만 담당(로직 없음).
 */
export const RelationEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<RelationEdgeType>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const label = data?.label ?? "";
  const isDirected = data?.isDirected ?? true;
  const isHighlighted = data?.isHighlighted ?? false;
  const isInactiveType = data?.isInactiveType ?? false;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={isDirected ? MarkerType.ArrowClosed : undefined}
        style={{
          stroke: isHighlighted ? HIGHLIGHT_STROKE : DEFAULT_STROKE,
          strokeWidth: isHighlighted ? 2.5 : 1.5,
          ...(isInactiveType ? { strokeDasharray: INACTIVE_DASH } : {}),
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className={`nodrag nopan rounded px-1.5 py-0.5 text-[10px] font-medium shadow-sm max-w-[160px] truncate ${
            isHighlighted ? "bg-red-50 text-red-700" : "bg-white text-gray-600"
          } ${isInactiveType ? "opacity-60" : ""}`}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
