// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IsoDate } from "@iib/domain";
import { useNodeClickRouting } from "@/features/valuechains/hooks/effects/useNodeClickRouting";
import type { NodeDetailResponse } from "@/features/valuechains/lib/dto";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ApiError } from "@/lib/http/api-client";

const buildQuery = (
  overrides: Partial<UseQueryResult<NodeDetailResponse, ApiError>>,
): UseQueryResult<NodeDetailResponse, ApiError> =>
  ({
    isSuccess: false,
    isError: false,
    isPending: true,
    data: undefined,
    error: null,
    ...overrides,
  }) as UseQueryResult<NodeDetailResponse, ApiError>;

const LISTED_DATA: NodeDetailResponse = {
  nodeId: "node-1",
  snapshotId: "snap-1",
  nodeKind: "listed_company",
  group: null,
  freeSubject: null,
  security: { securityId: "sec-1", ticker: "005930", market: "KRX", name: "삼성전자", listingStatus: "listed" },
  securityResolved: true,
};

describe("useNodeClickRouting", () => {
  it("listed_company + resolved 성공 → NODE_PANEL_CLOSED dispatch 후 router.push(자산 없음, asOf 없음)", () => {
    const dispatch = vi.fn();
    const push = vi.fn();

    renderHook(() =>
      useNodeClickRouting({
        selectedNodeId: "node-1",
        nodeDetailQuery: buildQuery({ isSuccess: true, data: LISTED_DATA }),
        selectedDate: null,
        dispatch,
        router: { push },
      }),
    );

    expect(dispatch).toHaveBeenCalledWith({ type: "NODE_PANEL_CLOSED" });
    expect(push).toHaveBeenCalledWith("/companies/005930?market=KRX");
  });

  it("S1='2025-03-10' → push URL에 asOf 포함(E3)", () => {
    const dispatch = vi.fn();
    const push = vi.fn();

    renderHook(() =>
      useNodeClickRouting({
        selectedNodeId: "node-1",
        nodeDetailQuery: buildQuery({ isSuccess: true, data: LISTED_DATA }),
        selectedDate: "2025-03-10" as IsoDate,
        dispatch,
        router: { push },
      }),
    );

    expect(push).toHaveBeenCalledWith("/companies/005930?market=KRX&asOf=2025-03-10");
  });

  it("listingStatus='delisted'여도 push를 수행한다(E4)", () => {
    const dispatch = vi.fn();
    const push = vi.fn();
    const delisted = { ...LISTED_DATA, security: { ...LISTED_DATA.security!, listingStatus: "delisted" as const } };

    renderHook(() =>
      useNodeClickRouting({
        selectedNodeId: "node-1",
        nodeDetailQuery: buildQuery({ isSuccess: true, data: delisted }),
        selectedDate: null,
        dispatch,
        router: { push },
      }),
    );

    expect(push).toHaveBeenCalled();
  });

  it("free_subject 성공 → push/dispatch 미호출", () => {
    const dispatch = vi.fn();
    const push = vi.fn();
    const freeSubjectData: NodeDetailResponse = {
      nodeId: "node-1",
      snapshotId: "snap-1",
      nodeKind: "free_subject",
      group: null,
      freeSubject: { name: "소비자", subjectType: "consumer", memo: null },
      security: null,
      securityResolved: true,
    };

    renderHook(() =>
      useNodeClickRouting({
        selectedNodeId: "node-1",
        nodeDetailQuery: buildQuery({ isSuccess: true, data: freeSubjectData }),
        selectedDate: null,
        dispatch,
        router: { push },
      }),
    );

    expect(push).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("securityResolved=false → push/dispatch 미호출(E1)", () => {
    const dispatch = vi.fn();
    const push = vi.fn();
    const fallbackData: NodeDetailResponse = { ...LISTED_DATA, security: null, securityResolved: false };

    renderHook(() =>
      useNodeClickRouting({
        selectedNodeId: "node-1",
        nodeDetailQuery: buildQuery({ isSuccess: true, data: fallbackData }),
        selectedDate: null,
        dispatch,
        router: { push },
      }),
    );

    expect(push).not.toHaveBeenCalled();
  });

  it("쿼리 error → push 미호출(E9)", () => {
    const dispatch = vi.fn();
    const push = vi.fn();

    renderHook(() =>
      useNodeClickRouting({
        selectedNodeId: "node-1",
        nodeDetailQuery: buildQuery({ isError: true }),
        selectedDate: null,
        dispatch,
        router: { push },
      }),
    );

    expect(push).not.toHaveBeenCalled();
  });

  it("동일 데이터로 리렌더 반복 → push 1회만(E10 중복 방지)", () => {
    const dispatch = vi.fn();
    const push = vi.fn();

    const { rerender } = renderHook(
      (props: { nodeId: string }) =>
        useNodeClickRouting({
          selectedNodeId: props.nodeId,
          nodeDetailQuery: buildQuery({ isSuccess: true, data: LISTED_DATA }),
          selectedDate: null,
          dispatch,
          router: { push },
        }),
      { initialProps: { nodeId: "node-1" } },
    );

    rerender({ nodeId: "node-1" });
    rerender({ nodeId: "node-1" });

    expect(push).toHaveBeenCalledTimes(1);
  });

  it("data.nodeId !== selectedNodeId(경합) → push 미호출", () => {
    const dispatch = vi.fn();
    const push = vi.fn();

    renderHook(() =>
      useNodeClickRouting({
        selectedNodeId: "node-2",
        nodeDetailQuery: buildQuery({ isSuccess: true, data: LISTED_DATA }),
        selectedDate: null,
        dispatch,
        router: { push },
      }),
    );

    expect(push).not.toHaveBeenCalled();
  });

  it("S3 null 복귀 후 동일 노드 재선택 → push 재수행(ref 리셋)", () => {
    const dispatch = vi.fn();
    const push = vi.fn();

    const { rerender } = renderHook(
      (props: { nodeId: string | null }) =>
        useNodeClickRouting({
          selectedNodeId: props.nodeId,
          nodeDetailQuery: props.nodeId ? buildQuery({ isSuccess: true, data: LISTED_DATA }) : buildQuery({}),
          selectedDate: null,
          dispatch,
          router: { push },
        }),
      { initialProps: { nodeId: "node-1" as string | null } },
    );

    expect(push).toHaveBeenCalledTimes(1);

    rerender({ nodeId: null });
    rerender({ nodeId: "node-1" });

    expect(push).toHaveBeenCalledTimes(2);
  });
});
