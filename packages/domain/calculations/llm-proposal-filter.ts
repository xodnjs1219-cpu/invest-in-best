import { LLM_RATIONALE_MAX_LENGTH } from "../constants/llm";
import { normalizeEdgePair } from "../valuechains/editorValidation";

/**
 * LLM 제안 범위 필터 (docs/usecases/030/plan.md 모듈 3, Business Logic — 순수).
 * BR-2·BR-4·BR-5·BR-7을 적재 전에 사전 적용한다. I/O 없음 — 전부 순수 함수.
 */

export type NodeKind = "listed_company" | "free_subject";

export interface ChainAnalysisContextNode {
  nodeId: string;
  displayName: string;
  nodeKind: NodeKind;
}

export interface ChainAnalysisContextEdge {
  sourceNodeId: string;
  targetNodeId: string;
  relationTypeId: string;
}

export interface ChainAnalysisContext {
  chainId: string;
  latestSnapshotId: string;
  nodes: ChainAnalysisContextNode[];
  edges: ChainAnalysisContextEdge[];
}

export interface ActiveRelationType {
  relationTypeId: string;
  name: string;
  isDirected: boolean;
}

export type LlmProposalType = "relation_add" | "relation_update" | "relation_delete";

export interface LlmProposalCandidate {
  proposalType: LlmProposalType;
  sourceNodeId: string;
  targetNodeId: string;
  relationTypeId: string | null;
  rationale: string;
}

export interface AcceptedProposal extends LlmProposalCandidate {
  relationTypeId: string; // F-1 — 통과분은 non-null 확정
  dedupeKey: string;
}

export type ProposalDropReason =
  | "UNKNOWN_NODE"
  | "SELF_REFERENCE"
  | "MISSING_RELATION_TYPE"
  | "INACTIVE_RELATION_TYPE"
  | "DUPLICATE_EDGE"
  | "EDGE_NOT_FOUND"
  | "UPDATE_AMBIGUOUS"
  | "UPDATE_NO_CHANGE"
  | "DUPLICATE_PENDING"
  | "MISSING_RATIONALE";

export interface DroppedProposal {
  candidate: LlmProposalCandidate;
  reason: ProposalDropReason;
}

export interface FilterProposalCandidatesResult {
  accepted: AcceptedProposal[];
  dropped: DroppedProposal[];
}

/**
 * 회차 내/기존 pending 대조가 공유하는 단일 중복 판정 키 규칙(R-5).
 * 무향 종류는 normalizeEdgePair로 노드 쌍을 정렬 정규화한다(D-6).
 */
export function buildProposalDedupeKey(
  chainId: string,
  sourceNodeId: string,
  targetNodeId: string,
  relationTypeId: string,
  proposalType: LlmProposalType,
  isDirected: boolean,
): string {
  const [a, b] = normalizeEdgePair(sourceNodeId, targetNodeId, isDirected);
  return `${chainId}|${a}|${b}|${relationTypeId}|${proposalType}`;
}

function findEdgesForPair(
  edges: ChainAnalysisContextEdge[],
  sourceNodeId: string,
  targetNodeId: string,
  isDirected: boolean,
): ChainAnalysisContextEdge[] {
  const targetPair = normalizeEdgePair(sourceNodeId, targetNodeId, isDirected);
  return edges.filter((edge) => {
    const edgePair = normalizeEdgePair(edge.sourceNodeId, edge.targetNodeId, isDirected);
    return edgePair[0] === targetPair[0] && edgePair[1] === targetPair[1];
  });
}

/**
 * 후보별 판정 순서(spec 4-6-3, R-10):
 * UNKNOWN_NODE → SELF_REFERENCE → MISSING/INACTIVE_RELATION_TYPE → 유형별 정합 →
 * DUPLICATE_PENDING → MISSING_RATIONALE(공백) → accepted(rationale은 길이 상한 절단).
 * 입력 배열·ctx는 변이하지 않는다(순수성).
 */
export function filterProposalCandidates(
  candidates: readonly LlmProposalCandidate[],
  ctx: ChainAnalysisContext,
  activeTypes: readonly ActiveRelationType[],
  existingPendingKeys: ReadonlySet<string>,
): FilterProposalCandidatesResult {
  const nodeIds = new Set(ctx.nodes.map((n) => n.nodeId));
  const activeTypeById = new Map(activeTypes.map((t) => [t.relationTypeId, t]));
  const accepted: AcceptedProposal[] = [];
  const dropped: DroppedProposal[] = [];
  const seenKeys = new Set<string>(existingPendingKeys);

  for (const candidate of candidates) {
    const drop = (reason: ProposalDropReason): void => {
      dropped.push({ candidate, reason });
    };

    if (!nodeIds.has(candidate.sourceNodeId) || !nodeIds.has(candidate.targetNodeId)) {
      drop("UNKNOWN_NODE");
      continue;
    }

    if (candidate.sourceNodeId === candidate.targetNodeId) {
      drop("SELF_REFERENCE");
      continue;
    }

    if (candidate.relationTypeId === null) {
      drop("MISSING_RELATION_TYPE");
      continue;
    }

    const relationType = activeTypeById.get(candidate.relationTypeId);
    if (!relationType) {
      drop("MISSING_RELATION_TYPE");
      continue;
    }

    const matchingEdges = findEdgesForPair(
      ctx.edges,
      candidate.sourceNodeId,
      candidate.targetNodeId,
      relationType.isDirected,
    );

    if (candidate.proposalType === "relation_add") {
      const duplicateEdge = matchingEdges.some((e) => e.relationTypeId === candidate.relationTypeId);
      if (duplicateEdge) {
        drop("DUPLICATE_EDGE");
        continue;
      }
    } else if (candidate.proposalType === "relation_update") {
      if (matchingEdges.length === 0) {
        drop("EDGE_NOT_FOUND");
        continue;
      }
      if (matchingEdges.length >= 2) {
        drop("UPDATE_AMBIGUOUS");
        continue;
      }
      const noChange = matchingEdges.some((e) => e.relationTypeId === candidate.relationTypeId);
      if (noChange) {
        drop("UPDATE_NO_CHANGE");
        continue;
      }
    } else {
      // relation_delete
      const existsExact = matchingEdges.some((e) => e.relationTypeId === candidate.relationTypeId);
      if (!existsExact) {
        drop("EDGE_NOT_FOUND");
        continue;
      }
    }

    const dedupeKey = buildProposalDedupeKey(
      ctx.chainId,
      candidate.sourceNodeId,
      candidate.targetNodeId,
      candidate.relationTypeId,
      candidate.proposalType,
      relationType.isDirected,
    );
    if (seenKeys.has(dedupeKey)) {
      drop("DUPLICATE_PENDING");
      continue;
    }

    const trimmedRationale = candidate.rationale.trim();
    if (trimmedRationale.length === 0) {
      drop("MISSING_RATIONALE");
      continue;
    }

    seenKeys.add(dedupeKey);
    accepted.push({
      ...candidate,
      relationTypeId: candidate.relationTypeId,
      rationale: trimmedRationale.slice(0, LLM_RATIONALE_MAX_LENGTH),
      dedupeKey,
    });
  }

  return { accepted, dropped };
}
