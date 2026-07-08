// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("300ms 경과 전에는 값이 반영되지 않는다", () => {
    const { result } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");
  });

  it("300ms 경과 후 값이 반영된다", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });
    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("ab");
  });

  it("연속 입력 시 타이머가 재시작되어 마지막 값만 반영된다", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });
    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: "abc" }); // 이 시점에 타이머 재시작 → 300ms는 여기서부터 다시 카운트
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a"); // 재시작 후 아직 300ms 미경과
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("abc");
  });

  it("언마운트 시 타이머를 취소한다(오류 없이 언마운트)", () => {
    const { unmount, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });
    rerender({ value: "ab" });
    expect(() => {
      unmount();
      act(() => {
        vi.advanceTimersByTime(300);
      });
    }).not.toThrow();
  });
});
