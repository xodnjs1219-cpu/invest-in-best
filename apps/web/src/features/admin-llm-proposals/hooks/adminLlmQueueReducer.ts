import type { LLM_PROPOSAL_STATUSES } from "@iib/domain";

/** 목록 상태 필터 — API 쿼리 파라미터와 동일 도메인(state_management.md §3-1). */
export type ProposalStatusFilter = (typeof LLM_PROPOSAL_STATUSES)[number];

export interface RejectTarget {
  proposalId: string;
  reason: string; // 선택 입력(빈 문자열 허용)
}

export interface AdminLlmQueueState {
  statusFilter: ProposalStatusFilter;
  page: number;
  selectedProposalId: string | null;
  rejectTarget: RejectTarget | null;
}

export type AdminLlmQueueAction =
  /** 필터 탭 변경 */
  | { type: "FILTER_CHANGED"; filter: ProposalStatusFilter }
  /** 페이지네이션 이동 */
  | { type: "PAGE_CHANGED"; page: number }
  /** 목록 행 선택 → 상세 패널 */
  | { type: "PROPOSAL_SELECTED"; proposalId: string }
  /** 상세 패널 닫기 */
  | { type: "PANEL_CLOSED" }
  /** 거부 버튼 클릭 → 사유 다이얼로그 열기 */
  | { type: "REJECT_DIALOG_OPENED"; proposalId: string }
  /** 거부 사유 입력 */
  | { type: "REJECT_REASON_CHANGED"; reason: string }
  /** 거부 다이얼로그 취소 */
  | { type: "REJECT_DIALOG_CLOSED" }
  /** 제안 처리 확정(승인 200 / 거부 200 / 409 계열) — 선택·다이얼로그 정리 */
  | { type: "PROPOSAL_RESOLVED"; proposalId: string };

export const initialAdminLlmQueueState: AdminLlmQueueState = {
  statusFilter: "pending",
  page: 1,
  selectedProposalId: null,
  rejectTarget: null,
};

/** 순수 함수 — I/O 없음, 동일 입력에 동일 출력(state_management.md §3-2 전이 규칙 표 그대로). */
export function adminLlmQueueReducer(
  state: AdminLlmQueueState,
  action: AdminLlmQueueAction,
): AdminLlmQueueState {
  switch (action.type) {
    case "FILTER_CHANGED": {
      if (state.statusFilter === action.filter) {
        return state;
      }
      return {
        statusFilter: action.filter,
        page: 1,
        selectedProposalId: null,
        rejectTarget: null,
      };
    }

    case "PAGE_CHANGED": {
      if (action.page < 1) {
        return state;
      }
      if (state.page === action.page && state.selectedProposalId === null) {
        return state;
      }
      return { ...state, page: action.page, selectedProposalId: null };
    }

    case "PROPOSAL_SELECTED": {
      if (state.selectedProposalId === action.proposalId) {
        return state;
      }
      return { ...state, selectedProposalId: action.proposalId };
    }

    case "PANEL_CLOSED": {
      if (state.selectedProposalId === null) {
        return state;
      }
      return { ...state, selectedProposalId: null };
    }

    case "REJECT_DIALOG_OPENED": {
      return { ...state, rejectTarget: { proposalId: action.proposalId, reason: "" } };
    }

    case "REJECT_REASON_CHANGED": {
      if (state.rejectTarget === null) {
        return state;
      }
      return { ...state, rejectTarget: { ...state.rejectTarget, reason: action.reason } };
    }

    case "REJECT_DIALOG_CLOSED": {
      if (state.rejectTarget === null) {
        return state;
      }
      return { ...state, rejectTarget: null };
    }

    case "PROPOSAL_RESOLVED": {
      const shouldClearSelection = state.selectedProposalId === action.proposalId;
      const shouldClearRejectTarget = state.rejectTarget?.proposalId === action.proposalId;

      if (!shouldClearSelection && !shouldClearRejectTarget) {
        return state;
      }

      return {
        ...state,
        selectedProposalId: shouldClearSelection ? null : state.selectedProposalId,
        rejectTarget: shouldClearRejectTarget ? null : state.rejectTarget,
      };
    }

    default:
      return state;
  }
}
