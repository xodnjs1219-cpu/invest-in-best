// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import {
  usePasswordResetConfirm,
  usePasswordResetRequest,
  useResetTokenVerify,
} from "@/features/auth/hooks/usePasswordReset";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("usePasswordResetRequest", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("성공 시 응답 메시지를 반환한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { message: "발송됨" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { result } = renderHook(() => usePasswordResetRequest(), { wrapper });

    // Act
    result.current.mutate({ email: "user@example.com" });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ message: "발송됨" });
  });

  it("오류 시 재시도하지 않는다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "PASSWORD_RESET_RATE_LIMITED", message: "rate" } }),
        { status: 429, headers: { "content-type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => usePasswordResetRequest(), { wrapper });

    // Act
    result.current.mutate({ email: "user@example.com" });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("useResetTokenVerify", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("성공 시 verified:true를 반환한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { verified: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { result } = renderHook(() => useResetTokenVerify(), { wrapper });

    // Act
    result.current.mutate({ tokenHash: "token-hash" });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ verified: true });
  });
});

describe("usePasswordResetConfirm", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("성공 시 완료 메시지를 반환한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { message: "완료" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { result } = renderHook(() => usePasswordResetConfirm(), { wrapper });

    // Act
    result.current.mutate({ newPassword: "abcd1234" });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ message: "완료" });
  });
});
