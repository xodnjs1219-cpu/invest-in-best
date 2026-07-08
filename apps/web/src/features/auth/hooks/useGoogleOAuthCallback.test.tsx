// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGoogleOAuthCallback } from "@/features/auth/hooks/useGoogleOAuthCallback";

const replaceMock = vi.fn();
const setUserMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/features/auth/context/current-user-provider", () => ({
  useCurrentUser: () => ({ setUser: setUserMock }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useGoogleOAuthCallback", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    replaceMock.mockClear();
    setUserMock.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("error 쿼리 존재 시 API 호출 없이 로그인 페이지로 replace한다 (Edge 1)", async () => {
    // Arrange
    global.fetch = vi.fn();
    const params = new URLSearchParams({ error: "access_denied" });

    // Act
    renderHook(() => useGoogleOAuthCallback(params), { wrapper });

    // Assert
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/auth/login?notice=oauth_cancelled"),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("code + next 쿼리 성공 시 setUser 후 next 경로로 replace한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            user: { id: "user-1", email: "a@b.com", role: "user" },
            isNewUser: false,
            redirectPath: "/companies/005930",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const params = new URLSearchParams({ code: "abc", next: "/companies/005930" });

    // Act
    renderHook(() => useGoogleOAuthCallback(params), { wrapper });

    // Assert
    await waitFor(() =>
      expect(setUserMock).toHaveBeenCalledWith({ id: "user-1", email: "a@b.com", role: "user" }),
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/companies/005930"));
  });

  it("code 존재 시 API를 1회만 호출한다(중복 실행 방지)", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            user: { id: "user-1", email: "a@b.com", role: "user" },
            isNewUser: false,
            redirectPath: "/",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const params = new URLSearchParams({ code: "abc" });

    // Act
    const { rerender } = renderHook(() => useGoogleOAuthCallback(params), { wrapper });
    rerender();
    rerender();

    // Assert
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  it("401(AUTH_OAUTH_EXCHANGE_FAILED) 시 phase='error'를 반환한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "AUTH_OAUTH_EXCHANGE_FAILED", message: "fail" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );
    const params = new URLSearchParams({ code: "used-code" });

    // Act
    const { result } = renderHook(() => useGoogleOAuthCallback(params), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.errorCode).toBe("AUTH_OAUTH_EXCHANGE_FAILED");
  });

  it("403(AUTH_OAUTH_EMAIL_UNVERIFIED) 시 phase='error'와 해당 코드가 설정된다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "AUTH_OAUTH_EMAIL_UNVERIFIED", message: "unverified" } }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    );
    const params = new URLSearchParams({ code: "abc" });

    // Act
    const { result } = renderHook(() => useGoogleOAuthCallback(params), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.errorCode).toBe("AUTH_OAUTH_EMAIL_UNVERIFIED"));
  });

  it("쿼리에 code도 error도 없으면 로그인 페이지로 replace한다", async () => {
    // Arrange
    global.fetch = vi.fn();
    const params = new URLSearchParams();

    // Act
    renderHook(() => useGoogleOAuthCallback(params), { wrapper });

    // Assert
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/auth/login"));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("next='//evil.com'은 '/'로 대체된다 (이중 방어)", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            user: { id: "user-1", email: "a@b.com", role: "user" },
            isNewUser: false,
            redirectPath: "/",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const params = new URLSearchParams({ code: "abc", next: "//evil.com" });

    // Act
    renderHook(() => useGoogleOAuthCallback(params), { wrapper });

    // Assert
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });
});
