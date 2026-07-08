// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOfficialChainCards } from "@/features/valuechains/hooks/useOfficialChainCards";

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

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("useOfficialChainCards", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("/valuechains/official 엔드포인트로 page=1, limit=20을 요청한다", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildResponse()));
    global.fetch = fetchMock;

    // Act
    const { result } = renderHook(() => useOfficialChainCards(), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/valuechains/official");
    expect(calledUrl).toContain("page=1");
    expect(calledUrl).toContain("limit=20");
  });

  it("hasMore=true 응답 후 fetchNextPage 호출 시 page=2로 재요청한다", async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(buildResponse({ pagination: { page: 1, limit: 20, totalCount: 21, hasMore: true } })),
      )
      .mockResolvedValueOnce(
        jsonResponse(buildResponse({ pagination: { page: 2, limit: 20, totalCount: 21, hasMore: false } })),
      );
    global.fetch = fetchMock;

    // Act
    const { result } = renderHook(() => useOfficialChainCards(), { wrapper });
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
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildResponse()));

    // Act
    const { result } = renderHook(() => useOfficialChainCards(), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
