import type { EditorEdge, EditorGroup, EditorNode } from "@iib/domain";
import type { LatestSnapshotResponse } from "@/features/valuechains/lib/dto";
import { getDefaultNodePosition } from "@/features/valuechains/editor/lib/nodePlacement";
import type { EditorBootstrap } from "@/features/valuechains/editor/state/chainEditorReducer";

/**
 * 편집 진입용 최신 구성 조회 응답(`LatestSnapshotResponse`) → 편집 도메인 모델(`EditorBootstrap`)
 * 순수 변환(UC-018 plan 모듈 16). 서버 ID를 clientNodeId/clientEdgeId/clientGroupId로 그대로 승계한다
 * (왕복 시 그룹 소속·좌표·관계 무손실 — `serializeSavePayload`와 대칭).
 * `reloadFromLatest()`(저장 충돌 재로드)도 동일 변환을 재사용한다.
 */
export function toEditorBootstrap(dto: LatestSnapshotResponse): EditorBootstrap {
  const groups: Record<string, EditorGroup> = {};
  for (const group of dto.groups) {
    groups[group.id] = { clientGroupId: group.id, name: group.name };
  }

  const nodes: Record<string, EditorNode> = {};
  dto.nodes.forEach((node, index) => {
    const position =
      node.positionX !== null && node.positionY !== null
        ? { x: node.positionX, y: node.positionY }
        : getDefaultNodePosition(index);

    if (node.nodeKind === "listed_company" && node.security) {
      nodes[node.id] = {
        clientNodeId: node.id,
        nodeKind: "listed_company",
        security: {
          securityId: node.security.id,
          ticker: node.security.ticker,
          name: node.security.name,
          market: node.security.market,
        },
        groupClientId: node.groupId,
        position,
      };
      return;
    }

    nodes[node.id] = {
      clientNodeId: node.id,
      nodeKind: "free_subject",
      subjectType: node.subjectType ?? "other",
      subjectName: node.subjectName ?? "",
      subjectMemo: node.subjectMemo,
      groupClientId: node.groupId,
      position,
    };
  });

  const edges: Record<string, EditorEdge> = {};
  for (const edge of dto.edges) {
    edges[edge.id] = {
      clientEdgeId: edge.id,
      sourceClientNodeId: edge.sourceNodeId,
      targetClientNodeId: edge.targetNodeId,
      relationTypeId: edge.relationTypeId,
    };
  }

  return {
    chainId: dto.chainId,
    baseSnapshotId: dto.snapshotId,
    name: dto.name,
    focusType: dto.focusType,
    focusSecurity: dto.focusSecurity
      ? {
          securityId: dto.focusSecurity.id,
          ticker: dto.focusSecurity.ticker,
          name: dto.focusSecurity.name,
          market: dto.focusSecurity.market,
        }
      : null,
    nodes,
    edges,
    groups,
  };
}
