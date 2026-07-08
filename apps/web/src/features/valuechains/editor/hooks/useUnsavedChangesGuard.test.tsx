// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChangesGuard } from "@/features/valuechains/editor/hooks/useUnsavedChangesGuard";

describe("useUnsavedChangesGuard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isDirty=true에서 beforeunload 이벤트 → preventDefault 호출됨", () => {
    renderHook(() => useUnsavedChangesGuard(true));

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("isDirty=false에서 beforeunload → 개입 없음", () => {
    renderHook(() => useUnsavedChangesGuard(false));

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it("내부 내비게이션 시도(링크 클릭) → isLeaveDialogOpen=true, confirmLeave() → 보류된 목적지로 이동", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    expect(result.current.isLeaveDialogOpen).toBe(false);

    const anchor = document.createElement("a");
    anchor.href = "/valuechains";
    document.body.appendChild(anchor);

    act(() => {
      anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(result.current.isLeaveDialogOpen).toBe(true);

    act(() => {
      result.current.confirmLeave();
    });
    expect(result.current.isLeaveDialogOpen).toBe(false);

    document.body.removeChild(anchor);
  });

  it("cancelLeave() → 잔류(다이얼로그 닫힘, 이동 없음)", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    const anchor = document.createElement("a");
    anchor.href = "/valuechains";
    document.body.appendChild(anchor);

    act(() => {
      anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(result.current.isLeaveDialogOpen).toBe(true);

    act(() => {
      result.current.cancelLeave();
    });
    expect(result.current.isLeaveDialogOpen).toBe(false);

    document.body.removeChild(anchor);
  });

  it("언마운트 후 이벤트 발생 → 리스너 미동작(누수 없음)", () => {
    const { unmount } = renderHook(() => useUnsavedChangesGuard(true));
    unmount();

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
