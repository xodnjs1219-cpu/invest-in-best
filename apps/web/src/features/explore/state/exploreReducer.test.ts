import { describe, expect, it } from "vitest";
import {
  EXPLORE_INITIAL_STATE,
  exploreReducer,
  selectIsSearchActive,
  selectShowTooShortNotice,
  type ExplorePageState,
} from "@/features/explore/state/exploreReducer";

describe("exploreReducer", () => {
  it("초기 상태에서 SEARCH_INPUT_CHANGED('삼성') → searchInput='삼성', 나머지 초기값 유지", () => {
    // Arrange
    const state = EXPLORE_INITIAL_STATE;

    // Act
    const next = exploreReducer(state, {
      type: "SEARCH_INPUT_CHANGED",
      payload: { value: "삼성" },
    });

    // Assert
    expect(next).toEqual({ ...EXPLORE_INITIAL_STATE, searchInput: "삼성" });
  });

  it("SEARCH_QUERY_COMMITTED('삼성') → submittedQuery='삼성', searchInput 불변", () => {
    // Arrange
    const state: ExplorePageState = { ...EXPLORE_INITIAL_STATE, searchInput: "삼성전" };

    // Act
    const next = exploreReducer(state, {
      type: "SEARCH_QUERY_COMMITTED",
      payload: { normalizedQuery: "삼성" },
    });

    // Assert
    expect(next.submittedQuery).toBe("삼성");
    expect(next.searchInput).toBe("삼성전");
  });

  it("SEARCH_QUERY_COMMITTED('') → submittedQuery='' → selectIsSearchActive=false", () => {
    // Arrange
    const state = EXPLORE_INITIAL_STATE;

    // Act
    const next = exploreReducer(state, {
      type: "SEARCH_QUERY_COMMITTED",
      payload: { normalizedQuery: "" },
    });

    // Assert
    expect(next.submittedQuery).toBe("");
    expect(selectIsSearchActive(next)).toBe(false);
  });

  it("SEARCH_MARKET_FILTER_CHANGED('US') → marketFilter='US', 검색어 필드 불변", () => {
    // Arrange
    const state: ExplorePageState = {
      ...EXPLORE_INITIAL_STATE,
      searchInput: "삼성",
      submittedQuery: "삼성",
    };

    // Act
    const next = exploreReducer(state, {
      type: "SEARCH_MARKET_FILTER_CHANGED",
      payload: { market: "US" },
    });

    // Assert
    expect(next.marketFilter).toBe("US");
    expect(next.searchInput).toBe("삼성");
    expect(next.submittedQuery).toBe("삼성");
  });

  it("임의 상태에서 SEARCH_CLEARED → EXPLORE_INITIAL_STATE와 동등", () => {
    // Arrange
    const state: ExplorePageState = {
      searchInput: "삼성",
      submittedQuery: "삼성",
      marketFilter: "KRX",
    };

    // Act
    const next = exploreReducer(state, { type: "SEARCH_CLEARED" });

    // Assert
    expect(next).toEqual(EXPLORE_INITIAL_STATE);
  });

  it("모든 액션에서 원본 state 객체를 비변이한다(새 객체 반환)", () => {
    // Arrange
    const state = EXPLORE_INITIAL_STATE;
    const original = { ...state };

    // Act
    const next = exploreReducer(state, {
      type: "SEARCH_INPUT_CHANGED",
      payload: { value: "x" },
    });

    // Assert
    expect(state).toEqual(original);
    expect(next).not.toBe(state);
  });

  it("selectShowTooShortNotice({searchInput:'  ', submittedQuery:'', ...}) → true", () => {
    // Arrange
    const state: ExplorePageState = { ...EXPLORE_INITIAL_STATE, searchInput: "  " };

    // Act & Assert
    expect(selectShowTooShortNotice(state)).toBe(true);
  });

  it("selectShowTooShortNotice({searchInput:'삼', ...}) → false (1자는 유효 — 결정 B-4)", () => {
    // Arrange
    const state: ExplorePageState = { ...EXPLORE_INITIAL_STATE, searchInput: "삼" };

    // Act & Assert
    expect(selectShowTooShortNotice(state)).toBe(false);
  });

  it("selectShowTooShortNotice({searchInput:'', ...}) → false (미입력은 안내 대상 아님)", () => {
    // Arrange
    const state = EXPLORE_INITIAL_STATE;

    // Act & Assert
    expect(selectShowTooShortNotice(state)).toBe(false);
  });
});
