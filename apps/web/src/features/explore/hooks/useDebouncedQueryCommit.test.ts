// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedQueryCommit } from "@/features/explore/hooks/useDebouncedQueryCommit";
import type { ExploreAction } from "@/features/explore/state/exploreReducer";

describe("useDebouncedQueryCommit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("입력 후 300ms 경과 시 SEARCH_QUERY_COMMITTED를 1회 dispatch한다(payload는 정규화값)", () => {
    // Arrange
    const dispatch = vi.fn<(action: ExploreAction) => void>();
    renderHook(() => useDebouncedQueryCommit("삼성", dispatch));

    // Act
    vi.advanceTimersByTime(300);

    // Assert
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "SEARCH_QUERY_COMMITTED",
      payload: { normalizedQuery: "삼성" },
    });
  });

  it("300ms 내 재입력 시 타이머가 재시작되어 최종 입력 기준 1회만 dispatch한다", () => {
    // Arrange
    const dispatch = vi.fn<(action: ExploreAction) => void>();
    const { rerender } = renderHook(
      ({ value }) => useDebouncedQueryCommit(value, dispatch),
      { initialProps: { value: "삼" } },
    );

    // Act
    vi.advanceTimersByTime(200);
    rerender({ value: "삼성" });
    vi.advanceTimersByTime(200);
    rerender({ value: "삼성전" });
    vi.advanceTimersByTime(300);

    // Assert
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "SEARCH_QUERY_COMMITTED",
      payload: { normalizedQuery: "삼성전" },
    });
  });

  it("299ms 시점에는 dispatch가 발생하지 않는다", () => {
    // Arrange
    const dispatch = vi.fn<(action: ExploreAction) => void>();
    renderHook(() => useDebouncedQueryCommit("삼성", dispatch));

    // Act
    vi.advanceTimersByTime(299);

    // Assert
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("언마운트 후 타이머가 만료되어도 dispatch가 발생하지 않는다", () => {
    // Arrange
    const dispatch = vi.fn<(action: ExploreAction) => void>();
    const { unmount } = renderHook(() => useDebouncedQueryCommit("삼성", dispatch));

    // Act
    unmount();
    vi.advanceTimersByTime(300);

    // Assert
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("공백만 입력 후 커밋되면 payload는 정규화 결과인 빈 문자열이다", () => {
    // Arrange
    const dispatch = vi.fn<(action: ExploreAction) => void>();
    renderHook(() => useDebouncedQueryCommit("  ", dispatch));

    // Act
    vi.advanceTimersByTime(300);

    // Assert
    expect(dispatch).toHaveBeenCalledWith({
      type: "SEARCH_QUERY_COMMITTED",
      payload: { normalizedQuery: "" },
    });
  });
});
