// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRelationTypes } from "@/features/valuechains/editor/hooks/useRelationTypes";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(status === 200 ? JSON.stringify({ data }) : JSON.stringify({ error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("useRelationTypes", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("전체 조회(active 미지정)로 API를 호출한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        relationTypes: [{ id: "rt1", name: "공급", isDirected: true, isActive: true }],
      }),
    );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useRelationTypes(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "rt1", name: "공급", isDirected: true, isActive: true }]);
    const requestUrl = (fetchMock.mock.calls[0]?.[0] as string) ?? "";
    expect(requestUrl).not.toContain("active=");
  });

  it("API 실패 시 isError=true로 전파된다", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "RELATION_TYPES.FETCH_FAILED", message: "오류" }, 500));

    const { result } = renderHook(() => useRelationTypes(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
