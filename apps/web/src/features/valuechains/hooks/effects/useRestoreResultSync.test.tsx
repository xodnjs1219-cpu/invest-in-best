// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IsoDate } from "@iib/domain";
import { useRestoreResultSync } from "@/features/valuechains/hooks/effects/useRestoreResultSync";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ApiError } from "@/lib/http/api-client";
import type { ChainViewResponse, SnapshotAtResponse } from "@/features/valuechains/lib/dto";

const buildQuery = <T,>(overrides: Partial<UseQueryResult<T, ApiError>>): UseQueryResult<T, ApiError> =>
  ({ isSuccess: false, isError: false, error: null, ...overrides }) as UseQueryResult<T, ApiError>;

describe("useRestoreResultSync", () => {
  it("S1=null + 최신 구조 성공 → SUCCEEDED{date:null} 1회 dispatch", () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useRestoreResultSync({
        selectedDate: null,
        latestQuery: buildQuery<ChainViewResponse>({ isSuccess: true }),
        snapshotAtQuery: buildQuery<SnapshotAtResponse>({}),
        dispatch,
        notifyRestoreFailure: vi.fn(),
      }),
    );

    expect(dispatch).toHaveBeenCalledWith({ type: "TIMELINE_RESTORE_SUCCEEDED", payload: { date: null } });
  });

  it("D 성공 → SUCCEEDED{date:D} dispatch", () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useRestoreResultSync({
        selectedDate: "2026-05-02" as IsoDate,
        latestQuery: buildQuery<ChainViewResponse>({}),
        snapshotAtQuery: buildQuery<SnapshotAtResponse>({ isSuccess: true }),
        dispatch,
        notifyRestoreFailure: vi.fn(),
      }),
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: "TIMELINE_RESTORE_SUCCEEDED",
      payload: { date: "2026-05-02" },
    });
  });

  it("D 실패(SNAPSHOT_NOT_FOUND) → 토스트 'snapshot-not-found' + FAILED dispatch 순서 보장", () => {
    const dispatch = vi.fn();
    const notifyRestoreFailure = vi.fn();
    const callOrder: string[] = [];
    notifyRestoreFailure.mockImplementation(() => callOrder.push("notify"));
    dispatch.mockImplementation(() => callOrder.push("dispatch"));

    renderHook(() =>
      useRestoreResultSync({
        selectedDate: "2010-01-01" as IsoDate,
        latestQuery: buildQuery<ChainViewResponse>({}),
        snapshotAtQuery: buildQuery<SnapshotAtResponse>({
          isError: true,
          error: { code: "SNAPSHOT_NOT_FOUND" } as ApiError,
        }),
        dispatch,
        notifyRestoreFailure,
      }),
    );

    expect(notifyRestoreFailure).toHaveBeenCalledWith("snapshot-not-found");
    expect(dispatch).toHaveBeenCalledWith({
      type: "TIMELINE_RESTORE_FAILED",
      payload: { failedDate: "2010-01-01" },
    });
    expect(callOrder).toEqual(["notify", "dispatch"]);
  });

  it("D 실패(그 외 오류) → 토스트 'error'", () => {
    const dispatch = vi.fn();
    const notifyRestoreFailure = vi.fn();

    renderHook(() =>
      useRestoreResultSync({
        selectedDate: "2026-05-02" as IsoDate,
        latestQuery: buildQuery<ChainViewResponse>({}),
        snapshotAtQuery: buildQuery<SnapshotAtResponse>({
          isError: true,
          error: { code: "TIMELINE_QUERY_FAILED" } as ApiError,
        }),
        dispatch,
        notifyRestoreFailure,
      }),
    );

    expect(notifyRestoreFailure).toHaveBeenCalledWith("error");
  });

  it("동일 결과 재렌더 → 중복 dispatch 없음", () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      (props: { selectedDate: IsoDate }) =>
        useRestoreResultSync({
          selectedDate: props.selectedDate,
          latestQuery: buildQuery<ChainViewResponse>({}),
          snapshotAtQuery: buildQuery<SnapshotAtResponse>({ isSuccess: true }),
          dispatch,
          notifyRestoreFailure: vi.fn(),
        }),
      { initialProps: { selectedDate: "2026-05-02" as IsoDate } },
    );

    rerender({ selectedDate: "2026-05-02" as IsoDate });
    rerender({ selectedDate: "2026-05-02" as IsoDate });

    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
