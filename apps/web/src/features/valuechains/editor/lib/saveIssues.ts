import type { ServerIssue } from "@iib/domain";
import { ApiError } from "@/lib/http/api-client";

/**
 * 저장 오류 정규화(UC-018 plan 모듈 18) — 순수 함수.
 * 주의: 공통 응답 헬�퍼(`backend/http/response.ts`)는 `error.details`를 클라이언트 응답에 노출하지
 * 않는다(로깅 전용 — 프로젝트 전역 정책). 따라서 서버가 지목한 정확한 요소 ID는 얻을 수 없고,
 * 호출측(Context `save()`)이 로컬 편집 상태에서 판별한 대상(`targets`)과 서버 오류 코드를 결합해
 * 하이라이트용 `ServerIssue`를 구성한다.
 */

const REJECTED_CODES = new Set([
  "VALUECHAINS.INVALID_REQUEST",
  "VALUECHAINS.DUPLICATE_NAME",
  "VALUECHAINS.CHAIN_LIMIT_EXCEEDED",
  "VALUECHAINS.NODE_LIMIT_EXCEEDED",
  "VALUECHAINS.INVALID_NODE",
  "VALUECHAINS.DUPLICATE_SECURITY_NODE",
  "VALUECHAINS.SECURITY_NOT_FOUND",
  "VALUECHAINS.INVALID_EDGE",
  "VALUECHAINS.INVALID_RELATION_TYPE",
  "VALUECHAINS.INVALID_GROUP",
  "VALUECHAINS.GROUP_NAME_REQUIRED",
  "VALUECHAINS.GROUP_KEY_DUPLICATE",
  "VALUECHAINS.GROUP_REF_INVALID",
]);

export type SaveErrorClass = "rejected" | "conflict" | "auth" | "network";

export type ServerIssueTargets = ServerIssue["targets"];

/**
 * `SAVE_REJECTED` 대상(422 전체 + 409 DUPLICATE_NAME)이면 `ServerIssue[]`(단일 이슈)를 구성한다.
 * 대상 아님(409 SAVE_CONFLICT/401/500/네트워크) → null(reducer 미유입).
 * `targets`는 호출측이 로컬 상태로 판별한 대상(details 미제공 — 상단 설명).
 */
export function normalizeSaveErrorToIssues(
  error: ApiError,
  targets: ServerIssueTargets,
): ServerIssue[] | null {
  const isDuplicateName = error.code === "VALUECHAINS.DUPLICATE_NAME";
  const isRejected = REJECTED_CODES.has(error.code) && error.status !== 409 || (isDuplicateName && error.status === 409);

  if (!isRejected) {
    return null;
  }

  const resolvedTargets: ServerIssueTargets = isDuplicateName ? { ...targets, field: "name" } : targets;

  return [
    {
      code: error.code,
      message: error.message,
      targets: resolvedTargets,
    },
  ];
}

/** `save()`(Context)의 분기 유틸 — 상태 갱신 여부를 결정한다. */
export function classifySaveError(error: ApiError): SaveErrorClass {
  if (error.code === "VALUECHAINS.SAVE_CONFLICT") {
    return "conflict";
  }
  if (error.status === 401) {
    return "auth";
  }
  if (error.status === 0 || error.status >= 500) {
    return "network";
  }
  return "rejected";
}
