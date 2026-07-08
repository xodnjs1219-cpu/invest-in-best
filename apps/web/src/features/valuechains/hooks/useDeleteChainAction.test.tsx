// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

import { useDeleteChainAction } from "@/features/valuechains/hooks/useDeleteChainAction";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useDeleteChainAction", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    pushMock.mockReset();
    replaceMock.mockReset();
    vi.restoreAllMocks();
  });

  it("requestDelete() 호출 시 다이얼로그가 열리고 mutate는 호출되지 않는다", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const { result } = renderHook(
      () => useDeleteChainAction({ chainId: "chain-1", chainName: "내 체인", source: "list" }),
      { wrapper },
    );
    act(() => {
      result.current.requestDelete();
    });

    expect(result.current.isDialogOpen).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancelDelete() 호출 시 다이얼로그가 닫히고 요청이 발생하지 않는다(E7)", () => {
    global.fetch = vi.fn();

    const { result } = renderHook(
      () => useDeleteChainAction({ chainId: "chain-1", chainName: "내 체인", source: "list" }),
      { wrapper },
    );
    act(() => {
      result.current.requestDelete();
    });
    act(() => {
      result.current.cancelDelete();
    });

    expect(result.current.isDialogOpen).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("confirmDelete() 호출 시 mutate({chainId})가 1회 실행된다", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const { result } = renderHook(
      () => useDeleteChainAction({ chainId: "chain-1", chainName: "내 체인", source: "list" }),
      { wrapper },
    );
    act(() => {
      result.current.confirmDelete();
    });

    await waitFor(() => expect(result.current.isDeleting).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/valuechains/chain-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("isDeleting=true 중 confirmDelete() 재호출 시 추가 요청이 발생하지 않는다", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(
      () => useDeleteChainAction({ chainId: "chain-1", chainName: "내 체인", source: "list" }),
      { wrapper },
    );
    act(() => {
      result.current.confirmDelete();
    });
    await waitFor(() => expect(result.current.isDeleting).toBe(true));
    act(() => {
      result.current.confirmDelete();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    act(() => {
      resolveFetch(new Response(null, { status: 204 }));
    });
    await waitFor(() => expect(result.current.isDeleting).toBe(false));
  });

  it("성공 + source='list'이면 라우팅 없이 다이얼로그만 닫는다", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const { result } = renderHook(
      () => useDeleteChainAction({ chainId: "chain-1", chainName: "내 체인", source: "list" }),
      { wrapper },
    );
    act(() => {
      result.current.confirmDelete();
    });

    await waitFor(() => expect(result.current.isDialogOpen).toBe(false));
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("성공 + source='view'이면 내 밸류체인 목록(메인)으로 replace 이동한다", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const { result } = renderHook(
      () => useDeleteChainAction({ chainId: "chain-1", chainName: "내 체인", source: "view" }),
      { wrapper },
    );
    act(() => {
      result.current.confirmDelete();
    });

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });

  it("403 CHAIN_FORBIDDEN 시 안내 문구를 노출하고 라우팅하지 않는다", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "CHAIN_FORBIDDEN", message: "권한 없음" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );

    const { result } = renderHook(
      () => useDeleteChainAction({ chainId: "chain-1", chainName: "내 체인", source: "list" }),
      { wrapper },
    );
    act(() => {
      result.current.confirmDelete();
    });

    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(result.current.errorMessage).toContain("권한");
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("500 INTERNAL_ERROR 시 재시도 유도 문구를 노출하고 다이얼로그는 유지된다(재시도 가능)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "실패" } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    const { result } = renderHook(
      () => useDeleteChainAction({ chainId: "chain-1", chainName: "내 체인", source: "list" }),
      { wrapper },
    );
    act(() => {
      result.current.requestDelete();
    });
    act(() => {
      result.current.confirmDelete();
    });

    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(result.current.isDialogOpen).toBe(true);
  });
});
