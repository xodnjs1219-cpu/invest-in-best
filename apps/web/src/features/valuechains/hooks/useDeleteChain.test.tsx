// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDeleteChain } from "@/features/valuechains/hooks/useDeleteChain";
import { chainCardQueryKeys } from "@/features/valuechains/hooks/chainCardQueryKeys";

describe("useDeleteChain", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("성공(204 무본문) 시 mine 쿼리를 무효화하고 체인 스코프 캐시를 제거한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const removeSpy = vi.spyOn(queryClient, "removeQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Act
    const { result } = renderHook(() => useDeleteChain(), { wrapper });
    result.current.mutate({ chainId: "chain-1" });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chainCardQueryKeys.mine });
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: ["valuechains", "chain-1"] });
  });

  it("DELETE /valuechains/{chainId}로 요청한다", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    global.fetch = fetchMock;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Act
    const { result } = renderHook(() => useDeleteChain(), { wrapper });
    result.current.mutate({ chainId: "chain-1" });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/valuechains/chain-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("실패 시 ApiError가 그대로 전파되고 invalidate/remove가 호출되지 않는다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "CHAIN_FORBIDDEN", message: "권한 없음" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const removeSpy = vi.spyOn(queryClient, "removeQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Act
    const { result } = renderHook(() => useDeleteChain(), { wrapper });
    result.current.mutate({ chainId: "chain-1" });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: "CHAIN_FORBIDDEN", status: 403 });
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });
});
