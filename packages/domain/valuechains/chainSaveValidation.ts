import { MAX_NODES_PER_CHAIN } from "../constants/limits";
import type { SaveChainGroupPayload, SaveChainNodePayload } from "../types/chainSave";
import type { SaveEdgePayload } from "./edgeSaveValidation";

/**
 * 구조 저장 검증 코어 (UC-018 plan 모듈 3) — 페이로드 형상 기준의 순수 일괄 검증.
 * 서버(저장 service)와 FE `collectClientIssues`가 동일 함수를 호출한다(DRY).
 * 엣지 규칙(자기 참조·중복 쌍·노드 참조)은 검사하지 않는다 — `edgeSaveValidation.validateEdgesPayload` 소관.
 */

export interface StructureViolation {
  reason:
    | "NODE_LIMIT_EXCEEDED" // E1 — nodes.length > MAX_NODES_PER_CHAIN
    | "NODE_KIND_FIELD_MISMATCH" // E16 — kind-필드 조합 위반(422 INVALID_NODE)
    | "DUPLICATE_SECURITY_NODE" // E17 — 동일 securityId 노드 2개 이상
    | "GROUP_NAME_REQUIRED" // E6 — 그룹 이름 공백(422 INVALID_GROUP)
    | "GROUP_REF_INVALID" // E6 — 노드의 groupClientId가 groups[]에 없음
    | "DUPLICATE_CLIENT_ID"; // 페이로드 내 clientNodeId/EdgeId/GroupId 중복(400)
  targets: { clientNodeIds?: string[]; clientGroupIds?: string[]; clientEdgeIds?: string[] };
}

function isFreeSubjectValid(node: SaveChainNodePayload): boolean {
  return (
    node.securityId === null &&
    node.subjectName !== null &&
    node.subjectName.trim().length > 0 &&
    node.subjectType !== null
  );
}

function isListedCompanyValid(node: SaveChainNodePayload): boolean {
  return node.securityId !== null && node.subjectName === null;
}

/**
 * 페이로드 형상 기준 순수 일괄 검증. 위반은 전부 수집(첫 건 중단 금지 — FE 일괄 하이라이트·details 계약).
 * 검증 순서(복수 위반 혼재 시 반환 순서 결정적): NODE_LIMIT_EXCEEDED → NODE_KIND_FIELD_MISMATCH
 * → DUPLICATE_SECURITY_NODE → GROUP_NAME_REQUIRED → GROUP_REF_INVALID → DUPLICATE_CLIENT_ID.
 */
export function validateChainStructure(payload: {
  groups: ReadonlyArray<SaveChainGroupPayload>;
  nodes: ReadonlyArray<SaveChainNodePayload>;
  edges: ReadonlyArray<SaveEdgePayload>;
}): StructureViolation[] {
  const { groups, nodes, edges } = payload;
  const violations: StructureViolation[] = [];

  if (nodes.length > MAX_NODES_PER_CHAIN) {
    violations.push({ reason: "NODE_LIMIT_EXCEEDED", targets: {} });
  }

  const kindMismatchIds: string[] = [];
  for (const node of nodes) {
    const isValid =
      node.nodeKind === "listed_company" ? isListedCompanyValid(node) : isFreeSubjectValid(node);
    if (!isValid) {
      kindMismatchIds.push(node.clientNodeId);
    }
  }
  if (kindMismatchIds.length > 0) {
    violations.push({ reason: "NODE_KIND_FIELD_MISMATCH", targets: { clientNodeIds: kindMismatchIds } });
  }

  const securityIdGroups = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.nodeKind === "listed_company" && node.securityId !== null) {
      const ids = securityIdGroups.get(node.securityId) ?? [];
      ids.push(node.clientNodeId);
      securityIdGroups.set(node.securityId, ids);
    }
  }
  const duplicateSecurityNodeIds = [...securityIdGroups.values()].filter((ids) => ids.length > 1).flat();
  if (duplicateSecurityNodeIds.length > 0) {
    violations.push({ reason: "DUPLICATE_SECURITY_NODE", targets: { clientNodeIds: duplicateSecurityNodeIds } });
  }

  const nameRequiredGroupIds = groups.filter((g) => g.name.trim().length === 0).map((g) => g.clientGroupId);
  if (nameRequiredGroupIds.length > 0) {
    violations.push({ reason: "GROUP_NAME_REQUIRED", targets: { clientGroupIds: nameRequiredGroupIds } });
  }

  const knownGroupIds = new Set(groups.map((g) => g.clientGroupId));
  const groupRefInvalidNodeIds = nodes
    .filter((n) => n.groupClientId !== null && !knownGroupIds.has(n.groupClientId))
    .map((n) => n.clientNodeId);
  if (groupRefInvalidNodeIds.length > 0) {
    violations.push({ reason: "GROUP_REF_INVALID", targets: { clientNodeIds: groupRefInvalidNodeIds } });
  }

  const duplicateClientIds: string[] = [];
  const collectDuplicates = (ids: string[]) => {
    const counts = new Map<string, number>();
    for (const id of ids) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const [id, count] of counts) {
      if (count > 1) {
        duplicateClientIds.push(id);
      }
    }
  };
  collectDuplicates(nodes.map((n) => n.clientNodeId));
  collectDuplicates(edges.map((e) => e.clientEdgeId));
  collectDuplicates(groups.map((g) => g.clientGroupId));
  if (duplicateClientIds.length > 0) {
    violations.push({ reason: "DUPLICATE_CLIENT_ID", targets: { clientNodeIds: duplicateClientIds } });
  }

  return violations;
}
