import {
  presetToDailyRange,
  resolveDailyMetricsRange,
  resolveQuarterlyMetricsRange,
  dateToCalendarQuarter,
  type IsoDate,
  type NodePosition,
} from "@iib/domain";
import { applyAutoLayout } from "@/components/mindmap/auto-layout";
import type { RenderEdge, RenderGraph, RenderGroup, RenderNode } from "@/components/mindmap/types";
import type {
  DailyMetricsResponse,
  QuarterlyMetricsResponse,
  ChainViewResponse,
  NodeDetailResponse,
} from "@/features/valuechains/lib/dto";
import type {
  DailyMetricsView,
  QuarterlyMetricsView,
  NodePanelView,
} from "@/features/valuechains/context/chain-view-context";
import type { ApiError } from "@/lib/http/api-client";
import type { ChainViewState, MetricsRange } from "@/features/valuechains/state/chain-view.reducer";
import type { QuarterlyParams } from "@/features/valuechains/hooks/chain-view-query-keys";

/** S1 → 과거 시점 조회 중 여부(state_management.md §5). */
export const selectIsTimeTraveling = (state: Pick<ChainViewState, "timeline">): boolean =>
  state.timeline.selectedDate !== null;

/**
 * 렌더링용 그래프 조립 (plan 모듈 C4, state_management.md §5) — 순수 함수.
 * 좌표 우선순위: S5 오버라이드 > 서버 position > `applyAutoLayout`(E11).
 * 접힌 그룹(S6)의 소속 노드·해당 노드로 이어지는 엣지는 숨기고 클러스터 요약(멤버 수)만 남긴다(E4).
 * 빈 그룹은 라벨만 있는 빈 클러스터로 유지한다(C-1). 미소속·고립 노드는 그대로 통과한다(E6).
 */
export const buildRenderGraph = (input: {
  structure: ChainViewResponse;
  localPositions: Readonly<Record<string, NodePosition>>;
  collapsedGroupIds: readonly string[];
}): RenderGraph => {
  const { structure, localPositions, collapsedGroupIds } = input;

  // 1. 그룹별 멤버 수 집계(빈 그룹 포함 — C-1/E7).
  const memberCountByGroup = new Map<string, number>();
  for (const node of structure.nodes) {
    if (node.groupId) {
      memberCountByGroup.set(node.groupId, (memberCountByGroup.get(node.groupId) ?? 0) + 1);
    }
  }
  const collapsedSet = new Set(collapsedGroupIds);

  const groups: RenderGroup[] = structure.groups.map((group) => ({
    id: group.id,
    label: group.name,
    isCollapsed: collapsedSet.has(group.id),
    memberCount: memberCountByGroup.get(group.id) ?? 0,
  }));

  // 2. auto-layout 폴백 좌표 계산(서버 position이 없는 노드만 대상 — E11).
  //    RenderNode.position은 non-null 타입이지만 auto-layout 입력은 서버 position(null 허용)을 그대로 전달한다.
  const autoLayoutInputNodes = structure.nodes.map(
    (node): RenderNode => ({
      id: node.id,
      kind: node.nodeKind,
      label: node.security?.name ?? node.subjectName ?? "",
      groupId: node.groupId,
      position: node.position as NodePosition, // null이면 auto-layout이 폴백 좌표를 계산한다.
    }),
  );
  const autoLayoutPositions = applyAutoLayout(autoLayoutInputNodes, groups);

  // 3. 숨겨야 할 노드(접힌 그룹 소속) 집합.
  const hiddenNodeIds = new Set(
    structure.nodes.filter((node) => node.groupId && collapsedSet.has(node.groupId)).map((n) => n.id),
  );

  // 4. 노드 렌더 모델 조립 — 좌표 우선순위: S5 > 서버 position > auto-layout.
  const nodes: RenderNode[] = structure.nodes
    .filter((node) => !hiddenNodeIds.has(node.id))
    .map((node) => {
      const fallbackPosition = autoLayoutPositions[node.id] ?? { x: 0, y: 0 };
      const position = localPositions[node.id] ?? node.position ?? fallbackPosition;
      return {
        id: node.id,
        kind: node.nodeKind,
        label: node.security?.name ?? node.subjectName ?? "",
        sublabel: node.security?.ticker,
        market: node.security?.market,
        listingStatus: node.security?.listingStatus,
        subjectType: node.subjectType ?? undefined,
        groupId: node.groupId,
        position,
      };
    });

  // 5. 엣지 렌더 모델 — 숨겨진 노드에 닿는 엣지는 제외(E4).
  const edges: RenderEdge[] = structure.edges
    .filter((edge) => !hiddenNodeIds.has(edge.sourceNodeId) && !hiddenNodeIds.has(edge.targetNodeId))
    .map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      label: edge.relationType.name,
      isDirected: edge.relationType.isDirected,
      isActive: edge.relationType.isActive,
    }));

  return { nodes, edges, groups };
};

// ============================================================================
// UC-010: 대시보드 지표 파라미터 셀렉터·뷰모델 빌더
// ============================================================================

/** S4 → 일별 지표 API 파라미터(하한/상한 보정 포함, UC-010 E8·E11). */
export const selectDailyMetricsParams = (
  range: MetricsRange,
  today: IsoDate,
): { from: IsoDate; to: IsoDate } => {
  if (range.kind === "preset") {
    return presetToDailyRange(range.preset, today);
  }
  const resolved = resolveDailyMetricsRange({ from: range.from, to: range.to, today });
  if (resolved.ok) {
    return { from: resolved.from, to: resolved.to };
  }
  // 보정 불가 조합(from > to)은 방어적으로 기본 1Y로 폴백(FE 1차 검증은 MetricsRangeSelector가 선행 차단).
  return presetToDailyRange("1Y", today);
};

/** S4 → 분기 지표 API 파라미터(역년 정규화 축, 하한 2015Q1). */
export const selectQuarterlyMetricsParams = (range: MetricsRange, today: IsoDate): QuarterlyParams => {
  const input =
    range.kind === "preset"
      ? { today }
      : {
          fromYear: dateToCalendarQuarter(range.from).calendarYear,
          fromQuarter: dateToCalendarQuarter(range.from).calendarQuarter,
          toYear: dateToCalendarQuarter(range.to).calendarYear,
          toQuarter: dateToCalendarQuarter(range.to).calendarQuarter,
          today,
        };
  const resolved = resolveQuarterlyMetricsRange(input);
  if (resolved.ok) {
    return {
      fromYear: resolved.from.year,
      fromQuarter: resolved.from.quarter,
      toYear: resolved.to.year,
      toQuarter: resolved.to.quarter,
    };
  }
  const fallback = resolveQuarterlyMetricsRange({ today });
  if (fallback.ok) {
    return {
      fromYear: fallback.from.year,
      fromQuarter: fallback.from.quarter,
      toYear: fallback.to.year,
      toQuarter: fallback.to.quarter,
    };
  }
  // 이론상 도달 불가(기본값은 항상 유효) — 타입 완결성을 위한 방어적 최종 폴백.
  return { fromYear: 2015, fromQuarter: 1, toYear: 2015, toQuarter: 1 };
};

type QueryLikeState<T> = { status: "pending" | "error" | "success"; data?: T; error?: ApiError | null };

/** 지표 쿼리 상태 + 하이라이트 시점 → `MetricsPanelView` 판별 유니온 조립(순수 함수). */
export const buildDailyMetricsView = (input: {
  query: QueryLikeState<DailyMetricsResponse>;
  highlightedDate: IsoDate | null;
}): DailyMetricsView => {
  const { query, highlightedDate } = input;
  if (query.status === "error") {
    return { status: "error" };
  }
  if (query.status === "pending" || !query.data) {
    return { status: "loading" };
  }
  if (query.data.series.length === 0) {
    return { status: "empty" };
  }
  return {
    status: "ready",
    current: query.data.current,
    series: query.data.series,
    highlightedDate,
    annotations: query.data.annotations,
  };
};

/** 분기 지표 쿼리 상태 → `MetricsPanelView` 조립(동형, C-8 "미제공"은 current:null로 표현). */
export const buildQuarterlyMetricsView = (input: {
  query: QueryLikeState<QuarterlyMetricsResponse>;
  highlightedDate: IsoDate | null;
}): QuarterlyMetricsView => {
  const { query, highlightedDate } = input;
  if (query.status === "error") {
    return { status: "error" };
  }
  if (query.status === "pending" || !query.data) {
    return { status: "loading" };
  }
  if (query.data.series.length === 0) {
    return { status: "empty" };
  }
  return {
    status: "ready",
    current: query.data.current,
    series: query.data.series,
    highlightedDate,
    annotations: query.data.annotations,
  };
};

// ============================================================================
// UC-011: 노드 정보 패널 뷰모델 빌더
// ============================================================================

/** S3 + 노드 상세 쿼리 상태 → `NodePanelView` 판별 유니온 조립(상태관리 문서 §8.2). */
export const buildNodePanelView = (input: {
  selectedNodeId: string | null;
  query: QueryLikeState<NodeDetailResponse>;
}): NodePanelView => {
  const { selectedNodeId, query } = input;
  if (selectedNodeId === null) {
    return { status: "closed" };
  }
  if (query.status === "pending") {
    return { status: "loading", nodeId: selectedNodeId };
  }
  if (query.status === "error") {
    return { status: "error", nodeId: selectedNodeId };
  }
  const data = query.data;
  if (!data) {
    return { status: "loading", nodeId: selectedNodeId };
  }
  if (data.nodeKind === "free_subject") {
    return {
      status: "free-subject",
      data: {
        name: data.freeSubject?.name ?? null,
        subjectType: data.freeSubject?.subjectType ?? null,
        memo: data.freeSubject?.memo ?? null,
        groupName: data.group?.name ?? null,
      },
    };
  }
  // listed_company
  if (!data.securityResolved) {
    return { status: "security-fallback", nodeId: selectedNodeId };
  }
  return { status: "routing" };
};
