// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWithdrawAccount } from "@/features/account/hooks/useWithdrawAccount";

const clearUserMock = vi.fn();
const clearClientAuthStateMock = vi.fn(async (_arg: unknown) => undefined);
const replaceMock = vi.fn();

vi.mock("@/features/auth/context/current-user-provider", () => ({
  useCurrentUser: () => ({ clearUser: clearUserMock }),
}));

vi.mock("@/features/auth/lib/clear-client-auth-state", () => ({
  clearClientAuthState: (arg: unknown) => clearClientAuthStateMock(arg),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useWithdrawAccount", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearUserMock.mockClear();
    clearClientAuthStateMock.mockClear();
    replaceMock.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("200 응답 시 clearClientAuthState 후 메인으로 이동한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { userId: "user-1", withdrawnAt: "2026-07-08T00:00:00.000Z" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => useWithdrawAccount(), { wrapper });

    // Act
    result.current.withdraw();

    // Assert
    await waitFor(() => expect(clearClientAuthStateMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("401 응답 시 멱등 완료 처리(clear + 메인 이동)한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "no session" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    const { result } = renderHook(() => useWithdrawAccount(), { wrapper });

    // Act
    result.current.withdraw();

    // Assert
    await waitFor(() => expect(clearClientAuthStateMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("409 응답 시 유일 Admin 안내를 표출하고 clearClientAuthState는 호출하지 않는다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "SOLE_ADMIN_WITHDRAWAL_BLOCKED", message: "blocked" } }),
        { status: 409, headers: { "content-type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => useWithdrawAccount(), { wrapper });

    // Act
    result.current.withdraw();

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorCode).toBe("SOLE_ADMIN_WITHDRAWAL_BLOCKED");
    expect(clearClientAuthStateMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("500/네트워크 오류 시 재시도 안내, 인증 상태를 유지한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "ACCOUNT_WITHDRAWAL_FAILED", message: "db down" } }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => useWithdrawAccount(), { wrapper });

    // Act
    result.current.withdraw();

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(clearClientAuthStateMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("isPending 동안 중복 호출이 억제된다", async () => {
    // Arrange
    let resolveFetch: (value: Response) => void = () => {};
    global.fetch = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { result } = renderHook(() => useWithdrawAccount(), { wrapper });

    // Act
    result.current.withdraw();
    result.current.withdraw();

    // Assert
    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(
        JSON.stringify({ data: { userId: "user-1", withdrawnAt: "2026-07-08T00:00:00.000Z" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  });
});
