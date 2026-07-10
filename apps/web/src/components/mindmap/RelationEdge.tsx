import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  MarkerType,
  useInternalNode,
  useStore,
  type Edge,
  type EdgeMarker,
  type EdgeProps,
} from "@xyflow/react";
import { getFloatingEdgeParams, getSideCenter } from "@/components/mindmap/floatingEdgeGeometry";

export type RelationEdgeData = {
  label: string;
  isDirected: boolean;
  /** 422 저장 오류로 위반 판정된 엣지 하이라이트(UC-016 spec API-3). */
  isHighlighted?: boolean;
  /** 관계 종류 마스터가 비활성(is_active=false)인 기존 엣지 시각 구분(BR-4/E4). */
  isInactiveType?: boolean;
  /** 편집 캔버스에서만 주입 — 있으면 라벨 우측에 삭제(×) 버튼을 렌더한다. */
  onDelete?: (edgeId: string) => void;
  /** 옵시디언식 hover 강조 — 이 엣지가 hover 노드에 연결됨(또렷하게). */
  isEmphasized?: boolean;
  /** 옵시디언식 hover 흐림 — hover 노드와 무관해 흐려짐(dim). */
  isDimmed?: boolean;
};

export type RelationEdgeType = Edge<RelationEdgeData>;

/** 화살표 색(뷰/편집 공용) — accent(기본)/danger(하이라이트) 토큰 참조. React Flow가 marker SVG로 생성. */
const ARROW_COLOR = { default: "var(--accent)", highlight: "var(--danger)" } as const;

/**
 * 유향 관계용 화살표 markerEnd 생성 — 뷰(MindmapCanvas)·편집(selectReactFlowEdges) 공용.
 * 유향이 아니면 undefined(화살표 없음). 하이라이트(422)면 danger 색.
 */
export function directedArrowMarker(
  isDirected: boolean,
  isHighlighted = false,
): EdgeMarker | undefined {
  if (!isDirected) return undefined;
  return {
    type: MarkerType.ArrowClosed,
    color: isHighlighted ? ARROW_COLOR.highlight : ARROW_COLOR.default,
    width: 18,
    height: 18,
  };
}

// 엣지 색은 디자인 토큰(border-strong / danger)과 계보를 맞춘다. 하이라이트는 위반 엣지(422) 표시.
const DEFAULT_STROKE = "var(--border-strong)";
const HIGHLIGHT_STROKE = "var(--danger)";
const INACTIVE_DASH = "4 4";

/**
 * 관계 엣지 컴포넌트 (plan 모듈 A8/M22, BR-4~BR-6) — 관계 라벨 표시.
 * `isDirected`가 true면 target 방향 화살표(markerEnd), false면 화살표 없음.
 * `isHighlighted`(422 오류 위치)·`isInactiveType`(비활성 종류)은 시각 구분 스타일만 담당(로직 없음).
 */
export const RelationEdge = ({
  id,
  source,
  target,
  markerEnd,
  data,
}: EdgeProps<RelationEdgeType>) => {
  // Floating edge — 고정 핸들이 아니라 두 노드 경계의 가장 가까운 지점끼리 잇는다(노드 위치 반영).
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const params = sourceNode && targetNode ? getFloatingEdgeParams(sourceNode, targetNode) : null;

  // 원형 표시 노드가 하나라도 관여하면 직선 경로로 잇는다(옵시디언 그래프뷰식) — 원 경계 접점에
  // 베지어를 쓰면 곡선이 원 안으로 파고들거나 크게 휘어 어색하다. 원형에서는 번들링도 끈다(방향 변 개념 약함).
  const isCircleEdge =
    (sourceNode?.data as { shape?: string })?.shape === "circle" ||
    (targetNode?.data as { shape?: string })?.shape === "circle";

  // 엣지 번들링 — 같은 target 노드의 같은 변으로 들어오는 엣지가 다수면, 그 변의 중앙 한 점으로
  // 접점을 통일한다(한 선으로 모아 들어가는 효과). 다른 엣지의 target 변은 store에서 함께 조회한다.
  const bundleToCenter = useStore((s) => {
    if (!params || !targetNode || isCircleEdge) return false;
    let sameSideCount = 0;
    for (const e of s.edges) {
      if (e.target !== target) continue;
      const es = s.nodeLookup.get(e.source);
      if (!es) continue;
      // 각 엣지의 target 변을 계산해, 이 엣지와 같은 변으로 들어오면 카운트.
      const p = getFloatingEdgeParams(es, targetNode);
      if (p.targetPos === params.targetPos) sameSideCount += 1;
    }
    return sameSideCount >= 2;
  });

  // 번들링 대상이면 target 접점을 변 중앙으로 교체한다(source 접점·나머지는 그대로).
  const targetContact =
    bundleToCenter && targetNode && params
      ? getSideCenter(targetNode, params.targetPos)
      : { x: params?.tx ?? 0, y: params?.ty ?? 0 };

  const [edgePath, labelX, labelY] = isCircleEdge
    ? getStraightPath({
        sourceX: params?.sx ?? 0,
        sourceY: params?.sy ?? 0,
        targetX: targetContact.x,
        targetY: targetContact.y,
      })
    : getBezierPath({
        sourceX: params?.sx ?? 0,
        sourceY: params?.sy ?? 0,
        sourcePosition: params?.sourcePos,
        targetX: targetContact.x,
        targetY: targetContact.y,
        targetPosition: params?.targetPos,
      });

  const label = data?.label ?? "";
  const isDirected = data?.isDirected ?? true;
  const isHighlighted = data?.isHighlighted ?? false;
  const isInactiveType = data?.isInactiveType ?? false;
  const isEmphasized = data?.isEmphasized ?? false;
  const isDimmed = data?.isDimmed ?? false;
  const onDelete = data?.onDelete;

  // 노드가 아직 측정되지 않았으면(마운트 직후) 렌더를 건너뛴다 — 다음 렌더에서 좌표가 채워진다.
  if (!params) {
    return null;
  }

  const baseStroke = isHighlighted ? HIGHLIGHT_STROKE : DEFAULT_STROKE;
  // 무향=점선, 비활성 종류=점선(기존 규칙). 유향은 실선 + 흐르는 빛 오버레이(아래).
  const dash = !isDirected || isInactiveType ? INACTIVE_DASH : undefined;
  // hover 강조 시 굵기·색을 accent로 끌어올린다.
  const strokeWidth = isHighlighted ? 2.5 : isEmphasized ? 2.25 : 1.5;
  const stroke = isEmphasized && !isHighlighted ? "var(--accent)" : baseStroke;
  const edgeClass = isEmphasized ? "mm-highlighted" : isDimmed ? "mm-dimmed" : "";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={edgeClass}
        style={{
          stroke,
          strokeWidth,
          ...(dash ? { strokeDasharray: dash } : {}),
        }}
      />
      {/* 유향 실선 위로 source→target 방향으로 흐르는 빛(데이터 흐름). 장식이므로 클릭 불가. */}
      {isDirected && (
        <path
          d={edgePath}
          fill="none"
          stroke={isHighlighted ? "var(--danger)" : "var(--accent)"}
          strokeWidth={2}
          strokeLinecap="round"
          className={`mm-edge-flow pointer-events-none ${edgeClass}`}
          data-animate-landing
          style={{ opacity: isDimmed ? 0.15 : 0.85 }}
          aria-hidden
        />
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            // 관계 타이틀 박스는 강조·dim 여부와 무관하게 항상 엣지 선보다 위에 온다(hover·클릭 모두).
            // dim 라벨도 선 아래로 내려가지 않도록 충분히 높은 base(20)를 두고, 강조/하이라이트는 더 위(30)로.
            zIndex: isHighlighted || isEmphasized ? 30 : 20,
          }}
          className={`nodrag nopan relative ${edgeClass} ${isInactiveType ? "opacity-60" : ""}`}
        >
          <span
            className={`flex max-w-[180px] items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] shadow-ambient ${
              isHighlighted
                ? "border-danger/40 bg-danger-soft text-danger"
                : "border-border bg-surface-raised text-fg"
            }`}
          >
            {/* 유향 관계는 방향 화살촉을 라벨에 병기해 "행하는 방향"을 텍스트로도 보강한다. */}
            {isDirected && (
              <svg
                viewBox="0 0 24 24"
                className={`h-2.5 w-2.5 shrink-0 ${isHighlighted ? "text-danger" : "text-accent"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4 12h14M13 6l6 6-6 6" />
              </svg>
            )}
            <span className="truncate">{label}</span>
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={`${label} 관계 삭제`}
              title="관계 삭제"
              // EdgeLabelRenderer는 라벨에 pointer-events:none을 기본 적용하므로 버튼은 auto로 되살린다.
              className="pointer-events-auto absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-raised text-fg-muted shadow-ambient transition-colors hover:border-danger hover:bg-danger hover:text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
