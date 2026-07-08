// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLatestSnapshot } from "@/features/valuechains/editor/hooks/useLatestSnapshot";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(status === 200 ? JSON.stringify({ data }) : JSON.stringify({ error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("useLatestSnapshot", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("chainId 지정 시 최신 구성 API를 호출한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        chainId: "c1",
        snapshotId: "snap1",
        nodes: [],
        edges: [],
        groups: [],
      }),
    );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useLatestSnapshot("c1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.snapshotId).toBe("snap1");
    const requestUrl = (fetchMock.mock.calls[0]?.[0] as string) ?? "";
    expect(requestUrl).toContain("/valuechains/c1/snapshots/latest");
  });

  it("chainId=null이면 쿼리가 비활성화되어 fetch가 호출되지 않는다", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    renderHook(() => useLatestSnapshot(null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
