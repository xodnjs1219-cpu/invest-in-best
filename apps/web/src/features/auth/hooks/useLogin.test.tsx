// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loginErrorMessage, useLogin } from "@/features/auth/hooks/useLogin";
import { ApiError } from "@/lib/http/api-client";
import { authErrorCodes } from "@/features/auth/backend/error";
import { AUTH_LOGIN_MESSAGES } from "@/features/auth/constants";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useLogin", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("성공 시 LoginResponse를 반환한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { userId: "user-1", email: "a@b.com", role: "user" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => useLogin(), { wrapper });

    // Act
    result.current.mutate({ email: "a@b.com", password: "abcd1234" });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ userId: "user-1", email: "a@b.com", role: "user" });
  });

  it("실패 시 재시도하지 않는다(retry:0)", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "AUTH_INVALID_CREDENTIALS", message: "invalid" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => useLogin(), { wrapper });

    // Act
    result.current.mutate({ email: "a@b.com", password: "wrong" });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("loginErrorMessage", () => {
  it("AUTH_INVALID_CREDENTIALS는 통일 문구를 반환한다", () => {
    // Act
    const message = loginErrorMessage(
      new ApiError(authErrorCodes.invalidCredentials, 401, "invalid"),
    );

    // Assert
    expect(message).toBe(AUTH_LOGIN_MESSAGES.invalidCredentials);
  });

  it("AUTH_EMAIL_NOT_CONFIRMED는 인증 안내 문구를 반환한다", () => {
    // Act
    const message = loginErrorMessage(
      new ApiError(authErrorCodes.emailNotConfirmed, 403, "not confirmed"),
    );

    // Assert
    expect(message).toBe(AUTH_LOGIN_MESSAGES.emailNotConfirmed);
  });

  it("AUTH_RATE_LIMITED는 재시도 안내 문구를 반환한다", () => {
    // Act
    const message = loginErrorMessage(new ApiError(authErrorCodes.rateLimited, 429, "rate"));

    // Assert
    expect(message).toBe(AUTH_LOGIN_MESSAGES.rateLimited);
  });

  it("AUTH_PROFILE_NOT_FOUND/AUTH_SERVICE_ERROR는 일시 오류 문구를 반환한다", () => {
    // Act & Assert
    expect(loginErrorMessage(new ApiError(authErrorCodes.profileNotFound, 500, "x"))).toBe(
      AUTH_LOGIN_MESSAGES.temporaryError,
    );
    expect(loginErrorMessage(new ApiError(authErrorCodes.serviceError, 502, "x"))).toBe(
      AUTH_LOGIN_MESSAGES.temporaryError,
    );
  });

  it("네트워크 오류(status 0)는 일반 오류로 폴백한다", () => {
    // Act
    const message = loginErrorMessage(new ApiError("NETWORK_ERROR", 0, "network"));

    // Assert
    expect(message).toBe(AUTH_LOGIN_MESSAGES.genericError);
  });

  it("ApiError가 아니면 일반 오류로 폴백한다", () => {
    // Act
    const message = loginErrorMessage(new Error("unknown"));

    // Assert
    expect(message).toBe(AUTH_LOGIN_MESSAGES.genericError);
  });
});
