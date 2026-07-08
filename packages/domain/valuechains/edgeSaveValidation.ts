import { normalizeEdgePair } from "./editorValidation";

/**
 * 엣지 저장 검증(서버 재검증, UC-016 plan 모듈 M3) — 순수 함수.
 * UC-018(사용자 체인)·UC-021(공식 체인) 저장 service가 이 모듈을 소비한다(BR-9 재검증 위임).
 * `normalizeEdgePair`(editorValidation.ts)를 재사용해 FE 즉시 검증과 판정 기준을 공유한다(DRY).
 */

export type NodeIdentity =
  | { kind: "listed_company"; securityId: string }
  | { kind: "free_subject"; subjectName: string; subjectType: string };

export interface PreviousEdgeIdentity {
  relationTypeId: string;
  source: NodeIdentity;
  target: NodeIdentity;
}

export interface SaveEdgePayload {
  clientEdgeId: string;
  sourceClientNodeId: string;
  targetClientNodeId: string;
  relationTypeId: string;
}

export type EdgeSaveViolationReason =
  | "EDGE_SELF_REFERENCE"
  | "EDGE_DUPLICATE_RELATION"
  | "EDGE_NODE_REF_INVALID"
  | "RELATION_TYPE_NOT_FOUND"
  | "RELATION_TYPE_INACTIVE_FOR_NEW_EDGE";

export interface EdgeSaveViolation {
  reason: EdgeSaveViolationReason;
  edge: SaveEdgePayload;
}

/**
 * 노드 정체성 문자열 키(정규화 대조용, BR-4·D-7) — 동일 정체성이면 동일 키를 생성한다.
 * 상장기업=securityId 일치, 자유 주체=이름+유형 일치 기준의 동등성 판정을 문자열 비교로 환원한다.
 */
function identityKey(identity: NodeIdentity): string {
  return identity.kind === "listed_company"
    ? `listed:${identity.securityId}`
    : `free:${identity.subjectName}:${identity.subjectType}`;
}

/**
 * 후보 엣지가 직전 스냅샷에 이미 존재하는지 판정(BR-4 — 비활성 종류의 기존 엣지 유지 허용).
 * 무향 관계는 (source,target) 정체성 쌍을 정규화해 대조한다(D-6).
 */
export function isEdgePreexisting(
  candidate: { source: NodeIdentity; target: NodeIdentity; relationTypeId: string },
  previousEdges: ReadonlyArray<PreviousEdgeIdentity>,
  isDirected: boolean,
): boolean {
  const candidatePair = normalizeEdgePair(
    identityKey(candidate.source),
    identityKey(candidate.target),
    isDirected,
  );

  return previousEdges.some((prev) => {
    if (prev.relationTypeId !== candidate.relationTypeId) {
      return false;
    }
    const prevPair = normalizeEdgePair(identityKey(prev.source), identityKey(prev.target), isDirected);
    return prevPair[0] === candidatePair[0] && prevPair[1] === candidatePair[1];
  });
}

export interface ValidateEdgesPayloadInput {
  nodes: ReadonlyArray<{ clientNodeId: string; identity: NodeIdentity }>;
  edges: ReadonlyArray<SaveEdgePayload>;
  relationTypes: ReadonlyMap<string, { isDirected: boolean; isActive: boolean }>;
  /** null = 직전 스냅샷 없음(신규 저장). */
  previousEdges: ReadonlyArray<PreviousEdgeIdentity> | null;
  /** official=true / user=false(R-1). */
  enforceActiveForNewEdges: boolean;
}

/**
 * 저장 페이로드 엣지 일괄 검증 — 위반은 전부 수집한다(첫 건에서 중단하지 않음, FE 일괄 하이라이트).
 * 판정 순서: 노드 참조 유효성 → 자기 참조 → 관계 종류 존재 → 정규화 쌍 중복 → 비활성 종류 신규 사용.
 */
export function validateEdgesPayload(input: ValidateEdgesPayloadInput): EdgeSaveViolation[] {
  const { nodes, edges, relationTypes, previousEdges, enforceActiveForNewEdges } = input;
  const nodeById = new Map(nodes.map((n) => [n.clientNodeId, n]));
  const violations: EdgeSaveViolation[] = [];
  const seenPairs = new Map<string, string>(); // "pairKey|relationTypeId" -> 첫 발견 clientEdgeId(중복 판정용)

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.sourceClientNodeId);
    const targetNode = nodeById.get(edge.targetClientNodeId);

    if (!sourceNode || !targetNode) {
      violations.push({ reason: "EDGE_NODE_REF_INVALID", edge });
      continue;
    }

    if (edge.sourceClientNodeId === edge.targetClientNodeId) {
      violations.push({ reason: "EDGE_SELF_REFERENCE", edge });
      continue;
    }

    const relationType = relationTypes.get(edge.relationTypeId);
    if (!relationType) {
      violations.push({ reason: "RELATION_TYPE_NOT_FOUND", edge });
      continue;
    }

    const pair = normalizeEdgePair(edge.sourceClientNodeId, edge.targetClientNodeId, relationType.isDirected);
    const pairKey = `${pair[0]}|${pair[1]}|${edge.relationTypeId}`;
    if (seenPairs.has(pairKey)) {
      violations.push({ reason: "EDGE_DUPLICATE_RELATION", edge });
      continue;
    }
    seenPairs.set(pairKey, edge.clientEdgeId);

    if (enforceActiveForNewEdges && !relationType.isActive) {
      const preexisting =
        previousEdges !== null &&
        isEdgePreexisting(
          { source: sourceNode.identity, target: targetNode.identity, relationTypeId: edge.relationTypeId },
          previousEdges,
          relationType.isDirected,
        );
      if (!preexisting) {
        violations.push({ reason: "RELATION_TYPE_INACTIVE_FOR_NEW_EDGE", edge });
      }
    }
  }

  return violations;
}
