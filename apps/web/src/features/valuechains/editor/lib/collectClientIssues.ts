import type { RelationType, ServerIssue } from "@iib/domain";
import { validateChainNameFormat, validateChainStructure, validateEdgesPayload } from "@iib/domain";
import type { ChainEditorState } from "@/features/valuechains/editor/state/chainEditorReducer";
import { serializeSavePayload } from "@/features/valuechains/editor/state/chainEditorSelectors";

/**
 * 저장 전 클라이언트 일괄 검증(UC-018 plan 모듈 4) — `save()` 액션이 서버 요청 전에 호출한다.
 * 편집 상태를 저장 페이로드 형상으로 사영한 뒤 서버와 동일한 순수 검증 모듈(`validateChainStructure`,
 * `validateEdgesPayload`)을 호출해 구현을 단일화한다(state 문서 §1-5).
 * 반환이 빈 배열이면 저장 진행 가능(`save()`가 그대로 서버에 요청한다).
 */
export function collectClientIssues(
  state: ChainEditorState,
  relationTypeById: ReadonlyMap<string, Pick<RelationType, "isDirected" | "isActive">>,
): ServerIssue[] {
  const issues: ServerIssue[] = [];

  const nameIssue = validateChainNameFormat(state.name);
  if (nameIssue) {
    issues.push({ code: "NAME_REQUIRED", message: "체인 이름을 입력하세요.", targets: { field: "name" } });
  }

  const payload = serializeSavePayload(state);

  const structureViolations = validateChainStructure({
    groups: payload.groups,
    nodes: payload.nodes,
    edges: payload.edges,
  });
  for (const violation of structureViolations) {
    if (violation.reason === "NODE_LIMIT_EXCEEDED") {
      issues.push({ code: "NODE_LIMIT_EXCEEDED", message: "노드 상한을 초과했습니다.", targets: {} });
      continue;
    }
    if (violation.reason === "GROUP_NAME_REQUIRED" || violation.reason === "GROUP_REF_INVALID") {
      issues.push({
        code: "INVALID_GROUP",
        message: "그룹 규칙을 위반했습니다.",
        targets: {
          clientGroupIds: violation.targets.clientGroupIds,
          clientNodeIds: violation.targets.clientNodeIds,
        },
      });
    }
    // NODE_KIND_FIELD_MISMATCH/DUPLICATE_SECURITY_NODE/DUPLICATE_CLIENT_ID는 UC-015 액션 검증이
    // 원천 차단하므로 정상 흐름에서 발생하지 않는다(버그 방어 — 별도 코드 노출 없이 저장만 차단).
  }

  const nodeIdentityById = new Map(
    payload.nodes.map((n) => [
      n.clientNodeId,
      n.nodeKind === "listed_company"
        ? { kind: "listed_company" as const, securityId: n.securityId as string }
        : { kind: "free_subject" as const, subjectName: n.subjectName as string, subjectType: n.subjectType as string },
    ]),
  );
  const edgeViolations = validateEdgesPayload({
    nodes: payload.nodes.map((n) => ({ clientNodeId: n.clientNodeId, identity: nodeIdentityById.get(n.clientNodeId)! })),
    edges: payload.edges,
    relationTypes: relationTypeById,
    previousEdges: null,
    enforceActiveForNewEdges: false,
  });
  if (edgeViolations.length > 0) {
    issues.push({
      code: "INVALID_EDGE",
      message: "관계(엣지) 규칙을 위반했습니다.",
      targets: { clientEdgeIds: edgeViolations.map((v) => v.edge.clientEdgeId) },
    });
  }

  return issues;
}
