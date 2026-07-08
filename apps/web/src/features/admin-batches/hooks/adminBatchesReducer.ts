import type { BatchJobType, BatchRunStatus } from "@iib/domain";

/** `/admin/batches` 페이지 상태(R-8) — 서버 데이터·폴링·로딩은 TanStack Query 소관(미보관). */
export interface AdminBatchesState {
  jobType: BatchJobType | null;
  status: BatchRunStatus | null;
  from: string | null;
  to: string | null;
  page: number;
  selectedRunId: string | null;
  failuresPage: number;
}

export type AdminBatchesAction =
  /** 작업 종류/상태/기간 필터 부분 갱신 — page 1 리셋 + 상세 닫힘(Main 5) */
  | {
      type: "FILTER_CHANGED";
      jobType?: BatchJobType | null;
      status?: BatchRunStatus | null;
      from?: string | null;
      to?: string | null;
    }
  /** 목록 페이지네이션 이동 — 상세 닫힘 */
  | { type: "PAGE_CHANGED"; page: number }
  /** 실행 항목 선택(상세 패널 오픈) — failuresPage 1 리셋 */
  | { type: "RUN_SELECTED"; runId: string }
  /** 상세 패널 닫기 */
  | { type: "DETAIL_CLOSED" }
  /** 실패 목록 페이지네이션 이동(상세 열림 중에만 유효) */
  | { type: "FAILURES_PAGE_CHANGED"; page: number };

export const initialAdminBatchesState: AdminBatchesState = {
  jobType: null,
  status: null,
  from: null,
  to: null,
  page: 1,
  selectedRunId: null,
  failuresPage: 1,
};

/** 순수 함수 — I/O 없음, 동일 입력에 동일 출력(R-8 전이 규칙). */
export function adminBatchesReducer(
  state: AdminBatchesState,
  action: AdminBatchesAction,
): AdminBatchesState {
  switch (action.type) {
    case "FILTER_CHANGED": {
      return {
        ...state,
        jobType: "jobType" in action ? (action.jobType ?? null) : state.jobType,
        status: "status" in action ? (action.status ?? null) : state.status,
        from: "from" in action ? (action.from ?? null) : state.from,
        to: "to" in action ? (action.to ?? null) : state.to,
        page: 1,
        selectedRunId: null,
        failuresPage: 1,
      };
    }

    case "PAGE_CHANGED": {
      if (action.page < 1) {
        return state;
      }
      if (state.page === action.page && state.selectedRunId === null) {
        return state;
      }
      return { ...state, page: action.page, selectedRunId: null, failuresPage: 1 };
    }

    case "RUN_SELECTED": {
      if (state.selectedRunId === action.runId) {
        return state;
      }
      return { ...state, selectedRunId: action.runId, failuresPage: 1 };
    }

    case "DETAIL_CLOSED": {
      if (state.selectedRunId === null) {
        return state;
      }
      return { ...state, selectedRunId: null };
    }

    case "FAILURES_PAGE_CHANGED": {
      if (state.selectedRunId === null) {
        return state;
      }
      if (state.failuresPage === action.page) {
        return state;
      }
      return { ...state, failuresPage: action.page };
    }

    default:
      return state;
  }
}
