import type { NodePosition } from "@iib/domain";
import { applyAutoLayout } from "@/components/mindmap/auto-layout";
import type { RenderEdge, RenderGraph, RenderGroup, RenderNode } from "@/components/mindmap/types";
import type { ChainViewResponse } from "@/features/valuechains/lib/dto";
import type { ChainViewState } from "@/features/valuechains/state/chain-view.reducer";

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
