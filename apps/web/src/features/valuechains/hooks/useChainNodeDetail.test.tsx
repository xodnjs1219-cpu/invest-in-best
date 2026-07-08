// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChainNodeDetail } from "@/features/valuechains/hooks/useChainNodeDetail";
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

describe("useChainNodeDetail", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("nodeId가 null이면 fetch가 발생하지 않는다(enabled=false)", () => {
    renderHook(() => useChainNodeDetail("chain-1", null), { wrapper: createWrapper() });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("nodeId 지정 시 올바른 URL로 1회 호출한다", async () => {
    apiFetchMock.mockResolvedValue({ nodeId: "node-1" });

    const { result } = renderHook(() => useChainNodeDetail("chain-1", "node-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/valuechains/chain-1/nodes/node-1");
  });

  it("404 응답은 재시도하지 않는다", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("NODE_NOT_FOUND", 404, "not found"));

    const { result } = renderHook(() => useChainNodeDetail("chain-1", "node-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("500 응답은 1회 재시도한다", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("INTERNAL_ERROR", 500, "boom"));

    const { result } = renderHook(() => useChainNodeDetail("chain-1", "node-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it("nodeId A→B 연속 변경 시 B 키의 결과만 최종 관찰된다(E10)", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.endsWith("/node-a")) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { nodeId: "node-a" };
      }
      return { nodeId: "node-b" };
    });

    const { result, rerender } = renderHook(({ nodeId }: { nodeId: string }) => useChainNodeDetail("chain-1", nodeId), {
      wrapper: createWrapper(),
      initialProps: { nodeId: "node-a" },
    });

    rerender({ nodeId: "node-b" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ nodeId: "node-b" });
  });
});
