// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { IsoDate } from "@iib/domain";
import { useTimelineUrlSync } from "@/features/valuechains/hooks/effects/useTimelineUrlSync";

const replaceMock = vi.hoisted(() => vi.fn());
const searchParamsRef = vi.hoisted(() => ({ current: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsRef.current,
}));

describe("useTimelineUrlSync", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    searchParamsRef.current = new URLSearchParams();
  });

  it("S2 확정(D) → ?at=D로 replace 1회", () => {
    renderHook(() =>
      useTimelineUrlSync({ lastAppliedDate: "2026-05-02" as IsoDate, hasRestoreConcluded: true }),
    );

    expect(replaceMock).toHaveBeenCalledWith("?at=2026-05-02", { scroll: false });
  });

  it("S2=null 확정 → ?at= 제거", () => {
    searchParamsRef.current = new URLSearchParams("at=2026-05-02");

    renderHook(() => useTimelineUrlSync({ lastAppliedDate: null, hasRestoreConcluded: true }));

    expect(replaceMock).toHaveBeenCalledWith("?", { scroll: false });
  });

  it("hasRestoreConcluded=false 동안 replace 미호출(딥링크 보존)", () => {
    renderHook(() =>
      useTimelineUrlSync({ lastAppliedDate: "2026-05-02" as IsoDate, hasRestoreConcluded: false }),
    );

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("동일 S2 재렌더 시 중복 replace 없음", () => {
    const { rerender } = renderHook(
      (props: { lastAppliedDate: IsoDate | null }) =>
        useTimelineUrlSync({ lastAppliedDate: props.lastAppliedDate, hasRestoreConcluded: true }),
      { initialProps: { lastAppliedDate: "2026-05-02" as IsoDate | null } },
    );

    rerender({ lastAppliedDate: "2026-05-02" as IsoDate | null });

    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
});
