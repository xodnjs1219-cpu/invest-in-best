// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateChainQuota, useChainQuotaGate } from "@/features/valuechains/editor/hooks/useChainQuotaGate";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const buildResponse = (totalCount: number) => ({
  items: [],
  pagination: { page: 1, limit: 20, totalCount, hasMore: false },
});

const jsonResponse = (data: unknown, status = 200) =>
  new Response(status === 200 ? JSON.stringify({ data }) : JSON.stringify({ error: data }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("evaluateChainQuota", () => {
  it("totalCount=49 → canCreate=true", () => {
    expect(evaluateChainQuota(49)).toEqual({ canCreate: true });
  });

  it("totalCount=50 → canCreate=false (경계값, MAX_CHAINS_PER_USER)", () => {
    expect(evaluateChainQuota(50)).toEqual({ canCreate: false });
  });

  it("totalCount=0 → canCreate=true", () => {
    expect(evaluateChainQuota(0)).toEqual({ canCreate: true });
  });
});

describe("useChainQuotaGate", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("totalCount=50 응답 → status='blocked', ownedChainCount=50", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildResponse(50)));

    const { result } = renderHook(() => useChainQuotaGate({ enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("blocked"));
    expect(result.current).toMatchObject({ status: "blocked", ownedChainCount: 50, maxChainsPerUser: 50 });
  });

  it("totalCount=49 응답 → status='allowed', ownedChainCount=49", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(buildResponse(49)));

    const { result } = renderHook(() => useChainQuotaGate({ enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("allowed"));
    expect(result.current).toMatchObject({ status: "allowed", ownedChainCount: 49 });
  });

  it("401 응답 → status='auth_required'", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "VALUECHAIN_LIST_UNAUTHORIZED", message: "로그인이 필요합니다." }, 401));

    const { result } = renderHook(() => useChainQuotaGate({ enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("auth_required"));
  });

  it("네트워크 오류 → status='error', retry() 호출 시 refetch 실행", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code: "VALUECHAIN_LIST_FETCH_FAILED", message: "오류" }, 500));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useChainQuotaGate({ enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("error"), { timeout: 3000 });
    const callsBeforeRetry = fetchMock.mock.calls.length;
    if (result.current.status === "error") {
      result.current.retry();
    }
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry), {
      timeout: 3000,
    });
  });

  it("enabled=false → API 미호출 + status='allowed'", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const { result } = renderHook(() => useChainQuotaGate({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: "allowed", ownedChainCount: 0 });
  });
});
