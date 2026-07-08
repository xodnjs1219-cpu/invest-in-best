// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/valuechains/source-chain-id",
}));

const useCurrentUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth/context/current-user-provider", () => ({
  useCurrentUser: useCurrentUserMock,
}));

import { useCloneChainAction } from "@/features/valuechains/hooks/useCloneChainAction";

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

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useCloneChainAction", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    pushMock.mockReset();
    useCurrentUserMock.mockReset();
    vi.restoreAllMocks();
  });

  it("비로그인 상태에서 requestClone() 호출 시 mutate 없이 로그인 페이지로 이동한다(returnTo 보존)", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "unauthenticated" });
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    // Act
    const { result } = renderHook(() => useCloneChainAction("source-chain-id"), { wrapper });
    act(() => {
      result.current.requestClone();
    });

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login?returnTo=%2Fvaluechains%2Fsource-chain-id"),
    );
  });

  it("로그인 상태에서 requestClone() 호출 시 mutate가 실행된다", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "authenticated" });
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(CLONE_RESPONSE, 201));

    // Act
    const { result } = renderHook(() => useCloneChainAction("source-chain-id"), { wrapper });
    act(() => {
      result.current.requestClone();
    });

    // Assert
    await waitFor(() => expect(result.current.isCloning).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/valuechains/source-chain-id/clone",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("성공 시 새 체인의 편집 캔버스로 이동한다", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "authenticated" });
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(CLONE_RESPONSE, 201));

    // Act
    const { result } = renderHook(() => useCloneChainAction("source-chain-id"), { wrapper });
    act(() => {
      result.current.requestClone();
    });

    // Assert
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/valuechains/${CLONE_RESPONSE.chainId}/edit`));
  });

  it("409 에러 시 상한 안내 메시지를 노출하고 라우팅하지 않는다", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "authenticated" });
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "CHAIN_LIMIT_EXCEEDED", message: "상한 도달" }, 409));

    // Act
    const { result } = renderHook(() => useCloneChainAction("source-chain-id"), { wrapper });
    act(() => {
      result.current.requestClone();
    });

    // Assert
    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(result.current.errorMessage).toContain("상한");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("401 에러 시 로그인 유도 라우팅을 수행한다", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "authenticated" });
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: "UNAUTHORIZED", message: "인증 필요" }, 401));

    // Act
    const { result } = renderHook(() => useCloneChainAction("source-chain-id"), { wrapper });
    act(() => {
      result.current.requestClone();
    });

    // Assert
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/auth/login?returnTo=")),
    );
  });

  it("isCloning이 mutation pending 상태와 동기화된다", async () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "authenticated" });
    let resolveFetch: (value: Response) => void = () => {};
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    // Act
    const { result } = renderHook(() => useCloneChainAction("source-chain-id"), { wrapper });
    act(() => {
      result.current.requestClone();
    });

    // Assert
    await waitFor(() => expect(result.current.isCloning).toBe(true));
    act(() => {
      resolveFetch(jsonResponse(CLONE_RESPONSE, 201));
    });
    await waitFor(() => expect(result.current.isCloning).toBe(false));
  });
});
