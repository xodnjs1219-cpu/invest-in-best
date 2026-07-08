import { MAX_NODES_PER_CHAIN } from "../constants/limits";
import type { EditorEdge, EditorGroup, EditorNode, FreeSubjectType, RelationType } from "../types/chainEditor";

/**
 * chain-editor 검증 순수 함수 (UC-013 plan 모듈 4, state_management.md §4.3).
 * FE 즉시 검증과 서버(UC-018) 최종 검증이 이 파일의 함수를 공유한다(검증 이중화, 구현 단일화).
 * 본 파일은 UC-013(`validateChainNameFormat`) + UC-015(노드 검증) + UC-016(엣지 검증)
 * + UC-017(그룹 편집 검증)을 구현한다.
 *
 * 확장 지점(후속 plan이 이 파일에 추가):
 * - UC-018: collectClientIssues(저장 전 사전 검증 일괄 실행)
 */

/** 이름 형식 검증 — trim 후 빈 문자열이면 NAME_REQUIRED (spec E3: 진입 단계는 공백/형식만, 중복은 UC-018 서버 검증). */
export function validateChainNameFormat(name: string): "NAME_REQUIRED" | null {
  return name.trim().length === 0 ? "NAME_REQUIRED" : null;
}

// ============================================================================
// UC-016: 엣지 편집 검증 (spec BR-1~BR-4, D-6 무향 정규화)
// ============================================================================

/**
 * 노드 쌍 정규화 — 유향이면 순서 유지, 무향이면 사전순 정렬(D-6).
 * 중복 판정(FE 즉시 검증)·저장 재검증(서버)이 모두 이 함수를 공유한다(DRY).
 */
export function normalizeEdgePair(
  sourceId: string,
  targetId: string,
  isDirected: boolean,
): [string, string] {
  if (isDirected) {
    return [sourceId, targetId];
  }
  return sourceId <= targetId ? [sourceId, targetId] : [targetId, sourceId];
}

export type EdgeBlockReason =
  | "NODE_NOT_FOUND"
  | "SELF_REFERENCE"
  | "RELATION_TYPE_INACTIVE"
  | "DUPLICATE_RELATION";

export interface EdgeCandidate {
  sourceClientNodeId: string;
  targetClientNodeId: string;
  relationTypeId: string;
}

export interface ValidateEdgeCandidateOptions {
  /** 관계 종류 변경(재검증) 시 자기 자신과의 충돌을 배제한다. */
  excludeEdgeId?: string;
}

/**
 * 엣지 후보 검증(state_management.md §4.3) — 판정 순서:
 * 1. source/target가 state.nodes에 없음 → NODE_NOT_FOUND
 * 2. source === target → SELF_REFERENCE(E1)
 * 3. relationTypeById에 없거나 isActive=false → RELATION_TYPE_INACTIVE(BR-4)
 * 4. 기존 엣지 중 동일 정규화 쌍 + 동일 관계 종류 존재(excludeEdgeId 제외) → DUPLICATE_RELATION(E2·BR-2)
 * 5. 통과 → null(동일 쌍 다른 종류 병존은 허용 — E3·BR-3)
 */
export function validateEdgeCandidate(
  state: { nodes: Record<string, EditorNode>; edges: Record<string, EditorEdge> },
  candidate: EdgeCandidate,
  relationTypeById: ReadonlyMap<string, Pick<RelationType, "isDirected" | "isActive">>,
  options: ValidateEdgeCandidateOptions = {},
): EdgeBlockReason | null {
  const { sourceClientNodeId, targetClientNodeId, relationTypeId } = candidate;

  if (!state.nodes[sourceClientNodeId] || !state.nodes[targetClientNodeId]) {
    return "NODE_NOT_FOUND";
  }

  if (sourceClientNodeId === targetClientNodeId) {
    return "SELF_REFERENCE";
  }

  const relationType = relationTypeById.get(relationTypeId);
  if (!relationType || !relationType.isActive) {
    return "RELATION_TYPE_INACTIVE";
  }

  const candidatePair = normalizeEdgePair(sourceClientNodeId, targetClientNodeId, relationType.isDirected);

  for (const edge of Object.values(state.edges)) {
    if (options.excludeEdgeId && edge.clientEdgeId === options.excludeEdgeId) {
      continue;
    }
    if (edge.relationTypeId !== relationTypeId) {
      continue;
    }
    const existingRelationType = relationTypeById.get(edge.relationTypeId);
    const existingIsDirected = existingRelationType?.isDirected ?? relationType.isDirected;
    const existingPair = normalizeEdgePair(edge.sourceClientNodeId, edge.targetClientNodeId, existingIsDirected);
    if (existingPair[0] === candidatePair[0] && existingPair[1] === candidatePair[1]) {
      return "DUPLICATE_RELATION";
    }
  }

  return null;
}

// ============================================================================
// UC-015: 노드 추가 검증 (spec BR-1~BR-3)
// ============================================================================

export type NodeBlockReason = "NODE_LIMIT_REACHED" | "DUPLICATE_SECURITY" | "SUBJECT_FIELD_REQUIRED";

/**
 * 상장기업 노드 추가 검증 — ① 노드 상한(BR-1) ② 동일 종목 중복(BR-2).
 * 저장 시 서버 재검증(UC-018)도 동일 로직을 재사용한다.
 */
export function validateListedNodeAdd(
  state: { nodes: Record<string, EditorNode> },
  securityId: string,
): NodeBlockReason | null {
  const nodes = Object.values(state.nodes);

  if (nodes.length >= MAX_NODES_PER_CHAIN) {
    return "NODE_LIMIT_REACHED";
  }

  const isDuplicate = nodes.some(
    (node) => node.nodeKind === "listed_company" && node.security.securityId === securityId,
  );
  if (isDuplicate) {
    return "DUPLICATE_SECURITY";
  }

  return null;
}

export interface FreeSubjectAddInput {
  subjectType: FreeSubjectType | null;
  subjectName: string;
}

/**
 * 자유 주체 노드 추가 검증 — ① 노드 상한(BR-1) ② 필수 필드(유형·이름, BR-3).
 * 자유 주체는 동일 이름/유형 중복을 차단하지 않는다(BR-2는 종목 노드 전용).
 */
export function validateFreeSubjectAdd(
  state: { nodes: Record<string, EditorNode> },
  input: FreeSubjectAddInput,
): NodeBlockReason | null {
  if (Object.keys(state.nodes).length >= MAX_NODES_PER_CHAIN) {
    return "NODE_LIMIT_REACHED";
  }

  if (input.subjectType == null || input.subjectName.trim().length === 0) {
    return "SUBJECT_FIELD_REQUIRED";
  }

  return null;
}

// ============================================================================
// UC-017: 그룹 편집 검증 (spec BR-1~BR-6, plan 모듈 M2)
// ============================================================================

export type GroupBlockReason = "NAME_REQUIRED" | "NO_NODES_SELECTED" | "GROUP_NOT_FOUND";

export interface GroupCreateInput {
  name: string;
  memberNodeIds: string[];
}

/**
 * 그룹 생성 검증 — 판정 순서: 이름 공백(NAME_REQUIRED) → 선택 노드 0개(NO_NODES_SELECTED) → 통과.
 * 이름 중복은 검사하지 않는다(E3 — 허용, 알림은 selectDuplicateGroupNames 파생 소관).
 */
export function validateGroupCreate(input: GroupCreateInput): GroupBlockReason | null {
  if (input.name.trim().length === 0) {
    return "NAME_REQUIRED";
  }
  if (input.memberNodeIds.length === 0) {
    return "NO_NODES_SELECTED";
  }
  return null;
}

/**
 * 그룹 이름 변경 검증 — ① 대상 그룹 미존재 → GROUP_NOT_FOUND ② 이름 공백 → NAME_REQUIRED ③ 통과.
 */
export function validateGroupRename(
  state: { groups: Record<string, EditorGroup> },
  clientGroupId: string,
  name: string,
): GroupBlockReason | null {
  if (!state.groups[clientGroupId]) {
    return "GROUP_NOT_FOUND";
  }
  if (name.trim().length === 0) {
    return "NAME_REQUIRED";
  }
  return null;
}
