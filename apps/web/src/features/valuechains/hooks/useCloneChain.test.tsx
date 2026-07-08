// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCloneChain } from "@/features/valuechains/hooks/useCloneChain";
import { chainCardQueryKeys } from "@/features/valuechains/hooks/chainCardQueryKeys";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(status < 400 ? JSON.stringify({ data }) : JSON.stringify({ error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

const CLONE_RESPONSE = {
  chainId: "new-chain-id",
  name: "반도체 (2)",
  chainType: "user",
  focusType: "industry",
  focusSecurityId: null,
  sourceChainId: "source-chain-id",
  snapshotId: "snap-1",
  clonedAt: "2026-07-08T09:30:00+09:00",
  nodeCount: 42,
  edgeCount: 57,
  groupCount: 5,
};

describe("useCloneChain", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("성공 시 응답 DTO를 반환하고 ['valuechains','mine'] 쿼리를 무효화한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(CLONE_RESPONSE, 201));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Act
    const { result } = renderHook(() => useCloneChain(), { wrapper });
    result.current.mutate({ chainId: "source-chain-id" });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(CLONE_RESPONSE);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chainCardQueryKeys.mine });
  });

  it("POST /valuechains/{chainId}/clone으로 요청하고 body 없이 호출한다", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CLONE_RESPONSE, 201));
    global.fetch = fetchMock;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Act
    const { result } = renderHook(() => useCloneChain(), { wrapper });
    result.current.mutate({ chainId: "source-chain-id" });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/valuechains/source-chain-id/clone",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("실패 시 ApiError가 그대로 전파되고 invalidate가 호출되지 않는다", async () => {
    // Arrange
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "CHAIN_LIMIT_EXCEEDED", message: "상한 도달" }, 409));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Act
    const { result } = renderHook(() => useCloneChain(), { wrapper });
    result.current.mutate({ chainId: "source-chain-id" });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: "CHAIN_LIMIT_EXCEEDED", status: 409 });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
