// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyBootstrap, useEditorBootstrap } from "@/features/valuechains/editor/hooks/useEditorBootstrap";
import type { ChainQuotaGate } from "@/features/valuechains/editor/hooks/useChainQuotaGate";

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
});
