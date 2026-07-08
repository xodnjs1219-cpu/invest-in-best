import { APPLICABILITY_REASONS, LLM_PROPOSAL_STATUSES, LLM_PROPOSAL_TYPES, REJECT_REASON_MAX_LENGTH } from "@iib/domain";

/** M3 리터럴 전체를 커버 — 누락 시 타입 에러(하드코딩 금지 규칙 이행). */
export const PROPOSAL_STATUS_LABELS: Record<(typeof LLM_PROPOSAL_STATUSES)[number], string> = {
  pending: "대기",
  approved: "승인됨",
  rejected: "거부됨",
  invalidated: "무효됨",
};

export const PROPOSAL_TYPE_LABELS: Record<(typeof LLM_PROPOSAL_TYPES)[number], string> = {
  relation_add: "추가",
  relation_update: "변경",
  relation_delete: "삭제",
};

export const APPLICABILITY_REASON_LABELS: Record<(typeof APPLICABILITY_REASONS)[number], string> = {
  NODE_NOT_FOUND: "참조 노드가 현재 구성에 없습니다",
  EDGE_NOT_FOUND: "대상 관계가 현재 구성에 없습니다",
  EDGE_ALREADY_EXISTS: "동일한 관계가 이미 존재합니다",
  RELATION_TYPE_INACTIVE: "관계 종류가 비활성 상태입니다",
  CHAIN_NOT_APPLICABLE: "대상 체인이 적용 대상이 아닙니다(공식/비보관 아님)",
};

/** 목록/상세 공용 빈 상태·다이얼로그 문구(E13, MVP 최소 구현). */
export const EMPTY_QUEUE_MESSAGE = "검토할 제안이 없습니다.";
export const LIST_LOAD_ERROR_MESSAGE = "제안 목록을 불러오지 못했습니다.";
export const LIST_RETRY_BUTTON_LABEL = "다시 시도";
export const APPROVE_CONFIRM_MESSAGE = "이 제안을 승인하시겠습니까? 승인 시 대상 체인에 새 스냅샷이 생성됩니다.";
export const REJECT_DIALOG_TITLE = "제안 거부";
export const REJECT_DIALOG_HELPER_TEXT = "사유는 기록용 로그로만 남습니다.";
export const REJECT_DIALOG_CONFIRM_LABEL = "거부";
export const REJECT_DIALOG_CANCEL_LABEL = "취소";
export const REJECT_REASON_PLACEHOLDER = "거부 사유를 입력하세요(선택 사항)";
export { REJECT_REASON_MAX_LENGTH };

/** mutationResultPolicy의 messageKey → 실제 토스트 문구 매핑(M13이 정의한 키와 1:1). */
export const MUTATION_TOAST_MESSAGES = {
  approveSuccess: "제안을 승인했습니다.",
  approveAlreadyProcessed: "이미 처리된 제안입니다. 목록을 새로고침했습니다.",
  approveConflict: "최신 구성과 충돌해 제안이 자동으로 무효 처리되었습니다.",
  approveRelationTypeInactive: "관계 종류가 비활성 상태라 승인할 수 없습니다. 거부 처리를 고려해 주세요.",
  approveChainNotApplicable: "대상 체인이 적용 대상이 아니라 승인할 수 없습니다.",
  approveFailed: "승인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  rejectSuccess: "제안을 거부했습니다.",
  rejectAlreadyProcessed: "이미 처리된 제안입니다. 목록을 새로고침했습니다.",
  rejectFailed: "거부 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  notFound: "대상 제안을 찾을 수 없습니다. 목록을 새로고침했습니다.",
} as const;

export type MutationToastMessageKey = keyof typeof MUTATION_TOAST_MESSAGES;
