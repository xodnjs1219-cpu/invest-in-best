import {
  FINANCIALS_DEFAULT_PERIOD,
  QUOTES_DEFAULT_PERIOD,
  type FinancialsPeriodPreset,
  type QuotesPeriodPreset,
} from "@iib/domain";
import type { CompanyDetailAction } from "@/features/companies/state/company-detail.actions";

/**
 * 기업 상세(UC-020) Store 상태 (state_management.md §1.1·§4.1) — 순수 UI 선택 상태 3개만 보유.
 * 서버 데이터(요약/재무/공시/시세/체인)는 TanStack Query 캐시에 위임하며 여기에 복사하지 않는다.
 */
export interface CompanyDetailState {
  readonly quotesPeriod: QuotesPeriodPreset;
  readonly financialsPeriod: FinancialsPeriodPreset;
  readonly isTimelineNoticeDismissed: boolean;
}

export const createInitialCompanyDetailState = (): CompanyDetailState => ({
  quotesPeriod: QUOTES_DEFAULT_PERIOD,
  financialsPeriod: FINANCIALS_DEFAULT_PERIOD,
  isTimelineNoticeDismissed: false,
});

/**
 * 순수 reducer(state_management.md §4.2) — Date.now()·fetch·라우터 접근 등 부수효과 금지,
 * 변이 금지(항상 새 객체 반환). 동일 값 재선택/재디스패치는 기존 state 참조를 그대로 반환한다
 * (불필요 리렌더 방지).
 */
export function companyDetailReducer(
  state: CompanyDetailState,
  action: CompanyDetailAction,
): CompanyDetailState {
  switch (action.type) {
    case "QUOTES_PERIOD_CHANGED": {
      if (state.quotesPeriod === action.payload.period) {
        return state;
      }
      return { ...state, quotesPeriod: action.payload.period };
    }
    case "FINANCIALS_PERIOD_CHANGED": {
      if (state.financialsPeriod === action.payload.period) {
        return state;
      }
      return { ...state, financialsPeriod: action.payload.period };
    }
    case "TIMELINE_NOTICE_DISMISSED": {
      if (state.isTimelineNoticeDismissed) {
        return state;
      }
      return { ...state, isTimelineNoticeDismissed: true };
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
