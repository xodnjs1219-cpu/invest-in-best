// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSecuritiesSearch } from "@/features/securities/hooks/useSecuritiesSearch";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const buildResponse = (overrides?: Partial<Record<string, unknown>>) => ({
  items: [],
  page: 1,
  pageSize: 20,
  hasMore: false,
  ...overrides,
});

describe("useSecuritiesSearch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("enabled=false면 fetch를 호출하지 않는다", async () => {
    // Arrange
    global.fetch = vi.fn();

    // Act
    renderHook(() => useSecuritiesSearch({ query: "삼성", market: "ALL" }, { enabled: false }), {
      wrapper,
    });

    // Assert
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("market='ALL'이면 요청 URL에 market 파라미터가 없다", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: buildResponse() }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    global.fetch = fetchMock;

    // Act
    const { result } = renderHook(
      () => useSecuritiesSearch({ query: "삼성", market: "ALL" }, { enabled: true }),
      { wrapper },
    );

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain("market=");
    expect(calledUrl).toContain("q=%EC%82%BC%EC%84%B1");
  });

  it("market='KRX'면 요청 URL에 market=KRX가 포함된다", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: buildResponse() }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    global.fetch = fetchMock;

    // Act
    const { result } = renderHook(
      () => useSecuritiesSearch({ query: "삼성", market: "KRX" }, { enabled: true }),
      { wrapper },
    );

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("market=KRX");
  });

  it("hasMore=true 응답 후 fetchNextPage() 호출 시 page=2로 재요청한다", async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: buildResponse({ hasMore: true, page: 1 }) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: buildResponse({ hasMore: false, page: 2 }) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    global.fetch = fetchMock;

    // Act
    const { result } = renderHook(
      () => useSecuritiesSearch({ query: "삼성", market: "ALL" }, { enabled: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondUrl = fetchMock.mock.calls[1]?.[0] as string;
    expect(secondUrl).toContain("page=2");
  });

  it("hasMore=false면 hasNextPage가 false다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: buildResponse({ hasMore: false }) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // Act
    const { result } = renderHook(
      () => useSecuritiesSearch({ query: "삼성", market: "ALL" }, { enabled: true }),
      { wrapper },
    );

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
