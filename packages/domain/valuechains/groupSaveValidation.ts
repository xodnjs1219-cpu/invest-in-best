/**
 * 그룹 저장 검증·정리 (UC-017 plan 모듈 M3, spec BR-6·BR-9) — 순수 함수.
 * 서버 저장 재검증(BR-9)과 빈 그룹 정리(BR-6)를 담당한다. UC-018/021 저장 service가 소비한다.
 * 프레임워크 의존 없음(React/Supabase import 금지) — FE/BE 공유 가능해야 한다.
 *
 * 한 노드의 그룹 참조가 단일 필드(groupClientId)이므로 다중 소속·중첩 검증은 불필요하다
 * (BR-2 — 데이터 구조상 표현 자체가 불가).
 */

export interface SaveGroupPayload {
  clientGroupId: string;
  name: string;
}

export interface GroupNodeRef {
  clientNodeId: string;
  groupClientId: string | null;
}

export interface GroupSaveViolation {
  reason: "GROUP_NAME_REQUIRED" | "GROUP_KEY_DUPLICATE" | "GROUP_REF_INVALID";
  /** 위반 그룹 식별(NAME_REQUIRED/KEY_DUPLICATE). */
  clientGroupIds: string[];
  /** 위반 노드 식별(REF_INVALID). */
  clientNodeIds: string[];
}

/**
 * 그룹 저장 페이로드 일괄 검증 — 위반은 전부 수집한다(첫 건에서 중단하지 않음, FE 일괄 하이라이트).
 * 판정 규칙:
 * - name.trim() === '' 인 그룹 → GROUP_NAME_REQUIRED(E2)
 * - clientGroupId 요청 내 중복 → GROUP_KEY_DUPLICATE(E8) — 중복된 키를 가진 모든 그룹 수집
 * - 노드의 groupClientId가 non-null인데 groups[]에 없음 → GROUP_REF_INVALID(E7·E6)
 * - groupClientId: null은 정상(그룹 미소속). 빈 그룹은 위반 아님.
 */
export function validateGroupsPayload(input: {
  groups: ReadonlyArray<SaveGroupPayload>;
  nodes: ReadonlyArray<GroupNodeRef>;
}): GroupSaveViolation[] {
  const { groups, nodes } = input;

  const nameRequiredGroupIds: string[] = [];
  for (const group of groups) {
    if (group.name.trim().length === 0) {
      nameRequiredGroupIds.push(group.clientGroupId);
    }
  }

  const groupIdCounts = new Map<string, number>();
  for (const group of groups) {
    groupIdCounts.set(group.clientGroupId, (groupIdCounts.get(group.clientGroupId) ?? 0) + 1);
  }
  const duplicateGroupIds = [...groupIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const knownGroupIds = new Set(groups.map((g) => g.clientGroupId));
  const refInvalidNodeIds: string[] = [];
  for (const node of nodes) {
    if (node.groupClientId !== null && !knownGroupIds.has(node.groupClientId)) {
      refInvalidNodeIds.push(node.clientNodeId);
    }
  }

  const violations: GroupSaveViolation[] = [];
  if (nameRequiredGroupIds.length > 0) {
    violations.push({ reason: "GROUP_NAME_REQUIRED", clientGroupIds: nameRequiredGroupIds, clientNodeIds: [] });
  }
  if (duplicateGroupIds.length > 0) {
    violations.push({ reason: "GROUP_KEY_DUPLICATE", clientGroupIds: duplicateGroupIds, clientNodeIds: [] });
  }
  if (refInvalidNodeIds.length > 0) {
    violations.push({ reason: "GROUP_REF_INVALID", clientGroupIds: [], clientNodeIds: refInvalidNodeIds });
  }

  return violations;
}

/**
 * 소속 노드 0개 그룹 제외 — 검증 통과 후 호출(BR-6, 오류 아님). 입력 배열은 비변이(새 배열 반환).
 */
export function pruneEmptyGroups(
  groups: ReadonlyArray<SaveGroupPayload>,
  nodes: ReadonlyArray<GroupNodeRef>,
): { groups: SaveGroupPayload[]; prunedGroupIds: string[] } {
  const referencedGroupIds = new Set(
    nodes.map((n) => n.groupClientId).filter((id): id is string => id !== null),
  );

  const keptGroups: SaveGroupPayload[] = [];
  const prunedGroupIds: string[] = [];
  for (const group of groups) {
    if (referencedGroupIds.has(group.clientGroupId)) {
      keptGroups.push(group);
    } else {
      prunedGroupIds.push(group.clientGroupId);
    }
  }

  return { groups: keptGroups, prunedGroupIds };
}
