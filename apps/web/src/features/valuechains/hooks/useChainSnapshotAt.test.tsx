// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IsoDate } from "@iib/domain";
import { useChainSnapshotAt } from "@/features/valuechains/hooks/useChainSnapshotAt";
import { ApiError } from "@/lib/http/api-client";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http/api-client")>("@/lib/http/api-client");
  return { ...actual, apiFetch: apiFetchMock };
});

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
};

describe("useChainSnapshotAt", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("date가 null이면 fetch가 발생하지 않는다(enabled 규칙)", () => {
    renderHook(() => useChainSnapshotAt("chain-1", null), { wrapper: createWrapper() });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("date 지정 시 올바른 URL로 호출한다", async () => {
    apiFetchMock.mockResolvedValue({ snapshot: {}, metrics: { daily: null, quarterly: null } });

    const { result } = renderHook(() => useChainSnapshotAt("chain-1", "2026-05-02" as IsoDate), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/valuechains/chain-1/snapshot-at?date=2026-05-02");
  });

  it("SNAPSHOT_NOT_FOUND(404)는 재시도 없이 실패한다", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("SNAPSHOT_NOT_FOUND", 404, "없음"));

    const { result } = renderHook(() => useChainSnapshotAt("chain-1", "2010-01-01" as IsoDate), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).code).toBe("SNAPSHOT_NOT_FOUND");
  });
});
