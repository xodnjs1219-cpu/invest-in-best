"use client";

import type { ReactNode } from "react";
import { BackgroundVariant, MiniMap, useReactFlow, type Node } from "@xyflow/react";

/**
 * 캔버스 공용 크롬(뷰어·에디터) — 줌 컨트롤·미니맵·범례·배경 파라미터.
 * DESIGN.md §4 캔버스 규약: 크롬은 무채색 서피스 토큰만 — 색은 콘텐츠(그룹 tone·시장 배지·강조)의 소유.
 * (Figma/Miro의 무채색 도구 크롬, Supabase 스키마 비주얼라이저의 도트 그리드 관례)
 */

/** 공용 배경(도트 그리드) 파라미터 — 뷰어·에디터 동일. `<Background {...MM_BACKGROUND_PROPS} />` */
export const MM_BACKGROUND_PROPS = {
  variant: BackgroundVariant.Dots,
  gap: 22,
  size: 1,
  color: "var(--border-strong)",
} as const;

/** 크롬 아이콘 버튼 — 노드모양 토글과 동일 문법(활성 상태만 accent 허용). */
export function CanvasIconButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "bg-accent text-accent-fg shadow-ambient"
          : "text-fg-muted hover:bg-surface-sunken hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  className: "h-4 w-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/**
 * 우상단 컨트롤 클러스터 — 확대/축소/전체 보기 + children 슬롯(뷰어의 노드모양 토글 등).
 * ReactFlowProvider 하위에서만 동작(useReactFlow).
 */
export function CanvasControls({ children }: { children?: ReactNode }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-[var(--radius)] border border-border bg-surface-raised/90 p-0.5 shadow-ambient backdrop-blur">
      <CanvasIconButton label="확대" onClick={() => void zoomIn({ duration: 120 })}>
        <svg {...ICON_PROPS}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3M8 11h6M11 8v6" />
        </svg>
      </CanvasIconButton>
      <CanvasIconButton label="축소" onClick={() => void zoomOut({ duration: 120 })}>
        <svg {...ICON_PROPS}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3M8 11h6" />
        </svg>
      </CanvasIconButton>
      <CanvasIconButton
        label="전체 보기"
        onClick={() => void fitView({ padding: 0.1, duration: 200 })}
      >
        <svg {...ICON_PROPS}>
          <path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3" />
        </svg>
      </CanvasIconButton>
      {children && (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          {children}
        </>
      )}
    </div>
  );
}

/** 미니맵 노드 색 — 그룹만 tone 색, 나머지는 무채색(크롬 원칙). */
const MINIMAP_GROUP_FILLS = [
  "var(--mm-group-1-soft)",
  "var(--mm-group-2-soft)",
  "var(--mm-group-3-soft)",
  "var(--mm-group-4-soft)",
] as const;

function minimapNodeColor(node: Node): string {
  if (node.type === "groupNode") {
    const tone = ((node.data as { tone?: number }).tone ?? 0) % MINIMAP_GROUP_FILLS.length;
    return MINIMAP_GROUP_FILLS[tone];
  }
  if (node.type === "companyNode") return "var(--border-strong)";
  return "var(--border)";
}

/** 우하단 미니맵 — 스타일은 globals.css `.react-flow__minimap` override가 담당. */
export function CanvasMiniMap() {
  return (
    <MiniMap
      pannable
      zoomable={false}
      position="bottom-right"
      style={{ width: 160, height: 110 }}
      maskColor="var(--mm-minimap-mask)"
      nodeColor={minimapNodeColor}
      nodeStrokeWidth={0}
      aria-label="마인드맵 미니맵"
    />
  );
}

const LEGEND_SWATCHES = [
  "bg-mm-group-1",
  "bg-mm-group-2",
  "bg-mm-group-3",
  "bg-mm-group-4",
] as const;

/** 범례 최대 표시 그룹 수 — 초과분은 +n 카운터로 접는다. */
const LEGEND_MAX_GROUPS = 8;

/**
 * 좌하단 범례 — 그룹 tone 스와치 + 표기 관례 + 조작 힌트(기존 힌트바 통합).
 * pointer-events 없음(정보 표시 전용), sm 이상에서만 표시.
 */
export function CanvasLegend({
  groups,
  hints,
}: {
  groups: readonly { label: string; tone: number }[];
  hints?: readonly string[];
}) {
  const visible = groups.slice(0, LEGEND_MAX_GROUPS);
  const overflow = groups.length - visible.length;

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden max-w-[60%] flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius)] border border-border bg-surface-raised/80 px-3 py-1.5 text-xs text-fg-muted backdrop-blur sm:flex">
      {visible.map((group) => (
        <span key={`${group.tone}-${group.label}`} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${LEGEND_SWATCHES[group.tone % LEGEND_SWATCHES.length]}`}
          />
          <span className="max-w-28 truncate">{group.label}</span>
        </span>
      ))}
      {overflow > 0 && <span className="text-fg-subtle">+{overflow}</span>}
      <span className="flex items-center gap-1.5 text-fg-subtle">
        <span aria-hidden>→</span> 유향
      </span>
      <span className="flex items-center gap-1.5 text-fg-subtle">
        <span aria-hidden>┈</span> 무향
      </span>
      <span className="text-fg-subtle">점선 테두리 = 자유 주체</span>
      {hints?.map((hint) => (
        <span key={hint} className="text-fg-subtle">
          {hint}
        </span>
      ))}
    </div>
  );
}
