// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyBootstrap, useEditorBootstrap } from "@/features/valuechains/editor/hooks/useEditorBootstrap";
import type { ChainQuotaGate } from "@/features/valuechains/editor/hooks/useChainQuotaGate";
import type { LatestSnapshotResponse } from "@/features/valuechains/lib/dto";

const SNAPSHOT_DTO: LatestSnapshotResponse = {
  chainId: "chain-1",
  chainType: "user",
  name: "나의 체인",
  focusType: "industry",
  focusSecurity: null,
  snapshotId: "snap-1",
  effectiveAt: "2026-07-05T09:00:00+09:00",
  groups: [],
  nodes: [],
  edges: [],
};

describe("createEmptyBootstrap", () => {
  it("빈 문서 팩토리 반환값이 스키마 기대치와 일치한다", () => {
    const bootstrap = createEmptyBootstrap();
    expect(bootstrap).toEqual({
      chainId: null,
      baseSnapshotId: null,
      name: "",
      focusType: "industry",
      focusSecurity: null,
      nodes: {},
      edges: {},
      groups: {},
    });
  });
});

describe("useEditorBootstrap", () => {
  it("gate='checking' → dispatch 미발생", () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useEditorBootstrap({
        mode: "create",
        gate: { status: "checking" } satisfies ChainQuotaGate,
        initialized: false,
        dispatch,
      }),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("gate='allowed' 전환 → 1회 dispatch", () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ gate, initialized }: { gate: ChainQuotaGate; initialized: boolean }) =>
        useEditorBootstrap({ mode: "create", gate, initialized, dispatch }),
      {
        initialProps: {
          gate: { status: "checking" } as ChainQuotaGate,
          initialized: false,
        },
      },
    );

    rerender({ gate: { status: "allowed", ownedChainCount: 3 }, initialized: false });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "EDITOR_INITIALIZED",
      payload: createEmptyBootstrap(),
    });
  });

  it("initialized=true 이후 리렌더 → 추가 dispatch 없음", () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ gate, initialized }: { gate: ChainQuotaGate; initialized: boolean }) =>
        useEditorBootstrap({ mode: "create", gate, initialized, dispatch }),
      {
        initialProps: {
          gate: { status: "allowed", ownedChainCount: 3 } as ChainQuotaGate,
          initialized: true,
        },
      },
    );

    rerender({ gate: { status: "allowed", ownedChainCount: 3 }, initialized: true });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("gate='blocked' → dispatch 미발생", () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useEditorBootstrap({
        mode: "create",
        gate: { status: "blocked", ownedChainCount: 50, maxChainsPerUser: 50 },
        initialized: false,
        dispatch,
      }),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // UC-018: edit 모드 부트스트랩(스냅샷 로드 → toEditorBootstrap → 1회 dispatch)
  // ==========================================================================

  it("edit 모드: 스냅샷 조회 성공 시 EDITOR_INITIALIZED 1회만 dispatch(baseSnapshotId=snapshotId)", () => {
    const dispatch = vi.fn();
    const gate: ChainQuotaGate = { status: "allowed", ownedChainCount: 0 };
    const { rerender } = renderHook(
      ({ latestSnapshot }: { latestSnapshot: { status: string; data?: LatestSnapshotResponse } }) =>
        useEditorBootstrap({
          mode: "edit",
          gate,
          initialized: false,
          dispatch,
          latestSnapshot,
        }),
      {
        initialProps: {
          latestSnapshot: { status: "pending" } as { status: string; data?: LatestSnapshotResponse },
        },
      },
    );

    expect(dispatch).not.toHaveBeenCalled();

    rerender({ latestSnapshot: { status: "success", data: SNAPSHOT_DTO } });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const call = dispatch.mock.calls[0]![0];
    expect(call.type).toBe("EDITOR_INITIALIZED");
    expect(call.payload.baseSnapshotId).toBe("snap-1");
    expect(call.payload.chainId).toBe("chain-1");
  });

  it("edit 모드: 스냅샷 조회 실패 → dispatch 없음", () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useEditorBootstrap({
        mode: "edit",
        gate: { status: "allowed", ownedChainCount: 0 },
        initialized: false,
        dispatch,
        latestSnapshot: { status: "error" },
      }),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("edit 모드: initialized=true 이후 리렌더 → 추가 dispatch 없음", () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ initialized }: { initialized: boolean }) =>
        useEditorBootstrap({
          mode: "edit",
          gate: { status: "allowed", ownedChainCount: 0 },
          initialized,
          dispatch,
          latestSnapshot: { status: "success", data: SNAPSHOT_DTO },
        }),
      { initialProps: { initialized: true } },
    );
    rerender({ initialized: true });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
