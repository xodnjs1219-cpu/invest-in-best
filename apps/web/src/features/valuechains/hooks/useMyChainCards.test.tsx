// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMyChainCards } from "@/features/valuechains/hooks/useMyChainCards";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const buildResponse = (overrides?: Partial<Record<string, unknown>>) => ({
  items: [],
  pagination: { page: 1, limit: 20, totalCount: 0, hasMore: false },
  ...overrides,
});

const jsonResponse = (data: unknown, status = 200) =>
  new Response(status === 200 ? JSON.stringify({ data }) : JSON.stringify({ error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("useMyChainCards", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("enabled=false면 fetch를 호출하지 않는다(비로그인 게스트 뷰)", async () => {
    // Arrange
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    // Act
    renderHook(() => useMyChainCards({ enabled: false }), { wrapper });

    // Assert
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enabled=true면 /valuechains/mine으로 요청한다", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildResponse()));
    global.fetch = fetchMock;

    // Act
    const { result } = renderHook(() => useMyChainCards({ enabled: true }), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/valuechains/mine");
  });

  it("401 응답이면 재시도 없이 즉시 오류로 전환된다(엣지 7)", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ code: "VALUECHAIN_LIST_UNAUTHORIZED", message: "로그인이 필요합니다." }, 401),
    );
    global.fetch = fetchMock;

    // Act
    const { result } = renderHook(() => useMyChainCards({ enabled: true }), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("hasMore=false면 hasNextPage가 false다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildResponse()));

    // Act
    const { result } = renderHook(() => useMyChainCards({ enabled: true }), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
