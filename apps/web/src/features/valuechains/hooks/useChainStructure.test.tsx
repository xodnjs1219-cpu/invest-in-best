// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStructure } from "@/features/valuechains/hooks/useChainStructure";
import { ApiError } from "@/lib/http/api-client";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http/api-client")>(
    "@/lib/http/api-client",
  );
  return { ...actual, apiFetch: apiFetchMock };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
};

describe("useChainStructure", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("enabled=false면 fetch가 발생하지 않는다", () => {
    // Arrange & Act
    renderHook(() => useChainStructure("chain-1", { enabled: false }), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("성공 시 ChainViewResponse 데이터를 노출한다", async () => {
    // Arrange
    const responseData = { chain: { id: "chain-1" } };
    apiFetchMock.mockResolvedValue(responseData);

    // Act
    const { result } = renderHook(() => useChainStructure("chain-1", { enabled: true }), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(responseData);
    expect(apiFetchMock).toHaveBeenCalledWith("/valuechains/chain-1");
  });

  it("404 ApiError는 재시도하지 않는다", async () => {
    // Arrange
    const error = new ApiError("CHAIN_NOT_FOUND", 404, "not found");
    apiFetchMock.mockRejectedValue(error);

    // Act
    const { result } = renderHook(() => useChainStructure("chain-1", { enabled: true }), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("500 오류는 1회 재시도한다", async () => {
    // Arrange
    const error = new ApiError("STRUCTURE_LOAD_FAILED", 500, "boom");
    apiFetchMock.mockRejectedValue(error);

    // Act
    const { result } = renderHook(() => useChainStructure("chain-1", { enabled: true }), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });
});
