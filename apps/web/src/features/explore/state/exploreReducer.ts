import { MIN_SEARCH_QUERY_LENGTH, normalizeSearchQuery } from "@iib/domain";

/**
 * 메인/탐색 페이지 상태 관리 (docs/pages/main-explore/state_management.md §4·§5의 SOT 구현).
 * React 비의존 순수 모듈 — 사이드이펙트(타이머·API 호출·라우팅) 금지, 단독 테스트 가능.
 * UC-007(메인/탐색 페이지 셸)은 이 모듈을 참조만 한다(중복 정의 금지).
 */

// ── State ─────────────────────────────────────────────
export type MarketFilter = "ALL" | "KRX" | "US";

export interface ExplorePageState {
  searchInput: string;
  submittedQuery: string;
  marketFilter: MarketFilter;
}

export const EXPLORE_INITIAL_STATE: ExplorePageState = {
  searchInput: "",
  submittedQuery: "",
  marketFilter: "ALL",
};

// ── Action ────────────────────────────────────────────
// 네이밍 컨벤션: <도메인>_<대상>_<사건(과거형)> — SCREAMING_SNAKE_CASE, "일어난 사건" 서술.
export type ExploreAction =
  | { type: "SEARCH_INPUT_CHANGED"; payload: { value: string } }
  | { type: "SEARCH_QUERY_COMMITTED"; payload: { normalizedQuery: string } }
  | { type: "SEARCH_MARKET_FILTER_CHANGED"; payload: { market: MarketFilter } }
  | { type: "SEARCH_CLEARED" };

/**
 * 순수 함수 — 사이드이펙트 금지, 새 객체 반환(불변성).
 */
export function exploreReducer(
  state: ExplorePageState,
  action: ExploreAction,
): ExplorePageState {
  switch (action.type) {
    case "SEARCH_INPUT_CHANGED":
      return { ...state, searchInput: action.payload.value };
    case "SEARCH_QUERY_COMMITTED":
      return { ...state, submittedQuery: action.payload.normalizedQuery };
    case "SEARCH_MARKET_FILTER_CHANGED":
      return { ...state, marketFilter: action.payload.market };
    case "SEARCH_CLEARED":
      return { ...EXPLORE_INITIAL_STATE };
    default:
      return state;
  }
}

// ── 파생 셀렉터 (상태 아님 — 렌더링 시 계산) ──────────────

/** 검색 결과 패널 표시 여부. */
export function selectIsSearchActive(state: ExplorePageState): boolean {
  return state.submittedQuery.length >= MIN_SEARCH_QUERY_LENGTH;
}

/** "검색 미실행" 안내 표시 여부: 원본 입력 존재 && 정규화 결과가 최소 길이 미만. */
export function selectShowTooShortNotice(state: ExplorePageState): boolean {
  if (state.searchInput.length === 0) {
    return false;
  }
  return normalizeSearchQuery(state.searchInput).length < MIN_SEARCH_QUERY_LENGTH;
}
