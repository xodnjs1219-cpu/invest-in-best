// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLogoutOutcome, useLogout } from "@/features/auth/hooks/useLogout";
import { ApiError } from "@/lib/http/api-client";
import { authErrorCodes } from "@/features/auth/backend/error";

describe("resolveLogoutOutcome", () => {
  it("성공(undefined)이면 'clear-and-go'다", () => {
    expect(resolveLogoutOutcome(undefined)).toBe("clear-and-go");
  });

  it("HTTP 500 AUTH_LOGOUT_FAILED면 'clear-and-go'다 (A-12 베스트 에포트)", () => {
    expect(resolveLogoutOutcome(new ApiError(authErrorCodes.logoutFailed, 500, "fail"))).toBe(
      "clear-and-go",
    );
  });

  it("네트워크 오류(status 0)면 'stay-and-retry'다", () => {
    expect(resolveLogoutOutcome(new ApiError("NETWORK_ERROR", 0, "network"))).toBe(
      "stay-and-retry",
    );
  });
});

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

describe("useLogout", () => {
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

  it("성공 시 clearClientAuthState 후 메인으로 replace한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { loggedOut: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { result } = renderHook(() => useLogout(), { wrapper });

    // Act
    result.current.logout();

    // Assert
    await waitFor(() => expect(clearClientAuthStateMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("500 AUTH_LOGOUT_FAILED에도 clearClientAuthState + 메인 이동한다(A-12)", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "AUTH_LOGOUT_FAILED", message: "gotrue down" } }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => useLogout(), { wrapper });

    // Act
    result.current.logout();

    // Assert
    await waitFor(() => expect(clearClientAuthStateMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });

  it("네트워크 오류 시 clearClientAuthState·라우팅 미호출, pending 해제", async () => {
    // Arrange
    global.fetch = vi.fn().mockRejectedValue(new TypeError("network down"));
    const { result } = renderHook(() => useLogout(), { wrapper });

    // Act
    result.current.logout();

    // Assert
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(clearClientAuthStateMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
