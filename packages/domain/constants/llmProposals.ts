/**
 * UC-022 LLM 관계 변경안 검토(승인/거부) 도메인 상수.
 * FE(admin-llm-proposals 훅/컴포넌트)와 BE(schema.ts Zod 검증)가 공용 import한다(DRY).
 */

/** 검토 큐 목록 페이지당 건수(spec §6.2-(1) "페이지당 건수는 상수"). */
export const ADMIN_LLM_PROPOSALS_PAGE_SIZE = 20;

/** 거부 사유(reason) 최대 길이(R-2 — 계약 검증용, 영속화는 하지 않음). */
export const REJECT_REASON_MAX_LENGTH = 500;

/** `llm_relation_proposals.proposal_type` DB enum과 동일 값. */
export const LLM_PROPOSAL_TYPES = ["relation_add", "relation_update", "relation_delete"] as const;

/** `llm_relation_proposals.status` DB enum과 동일 값. */
export const LLM_PROPOSAL_STATUSES = ["pending", "approved", "rejected", "invalidated"] as const;

/** `llm_proposal_applicability()` SQL 헬퍼가 반환하는 적용 불가 사유. */
export const APPLICABILITY_REASONS = [
  "NODE_NOT_FOUND",
  "EDGE_NOT_FOUND",
  "EDGE_ALREADY_EXISTS",
  "RELATION_TYPE_INACTIVE",
  "CHAIN_NOT_APPLICABLE",
] as const;
