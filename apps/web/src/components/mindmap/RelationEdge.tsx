import { BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType, type Edge, type EdgeProps } from "@xyflow/react";

export type RelationEdgeData = {
  label: string;
  isDirected: boolean;
};

export type RelationEdgeType = Edge<RelationEdgeData>;

/**
 * 관계 엣지 컴포넌트 (plan 모듈 A8, BR-4) — 관계 라벨 표시.
 * `isDirected`가 true면 target 방향 화살표(markerEnd), false면 화살표 없음.
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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={isDirected ? MarkerType.ArrowClosed : undefined}
        style={{ stroke: "#94a3b8", strokeWidth: 1.5 }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className="nodrag nopan rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 shadow-sm"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
