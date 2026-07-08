// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { usePasswordResetFlow } from "@/features/auth/hooks/usePasswordResetFlow";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("usePasswordResetFlow", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("tokenHash 없으면 초기 step이 'request'다", () => {
    // Act
    const { result } = renderHook(() => usePasswordResetFlow(null), { wrapper });

    // Assert
    expect(result.current.step).toBe("request");
  });

  it("tokenHash 있으면 verifying에서 verify가 1회 호출되고 성공 시 newPassword로 전환된다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { verified: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // Act
    const { result } = renderHook(() => usePasswordResetFlow("token-hash"), { wrapper });

    // Assert
    expect(result.current.step).toBe("verifying");
    await waitFor(() => expect(result.current.step).toBe("newPassword"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("verify 400 시 invalid로 전환된다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "PASSWORD_RESET_TOKEN_INVALID", message: "invalid" } }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    // Act
    const { result } = renderHook(() => usePasswordResetFlow("bad-token"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.step).toBe("invalid"));
  });

  it("submitEmail 성공 시 sent로 전환된다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { message: "발송됨" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { result } = renderHook(() => usePasswordResetFlow(null), { wrapper });

    // Act
    await act(async () => {
      await result.current.actions.submitEmail("user@example.com");
    });

    // Assert
    expect(result.current.step).toBe("sent");
  });

  it("submitEmail 429 시 step은 request 유지 + errorCode 설정", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "PASSWORD_RESET_RATE_LIMITED", message: "rate" } }),
        { status: 429, headers: { "content-type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => usePasswordResetFlow(null), { wrapper });

    // Act
    await act(async () => {
      await result.current.actions.submitEmail("user@example.com");
    });

    // Assert
    await waitFor(() => expect(result.current.step).toBe("request"));
    expect(result.current.errorCode).toBe("PASSWORD_RESET_RATE_LIMITED");
  });

  it("submitNewPassword 성공 시 done으로 전환된다", async () => {
    // Arrange
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { verified: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { message: "완료" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const { result } = renderHook(() => usePasswordResetFlow("token-hash"), { wrapper });
    await waitFor(() => expect(result.current.step).toBe("newPassword"));

    // Act
    await act(async () => {
      await result.current.actions.submitNewPassword("abcd1234");
    });

    // Assert
    expect(result.current.step).toBe("done");
  });

  it("submitNewPassword 401 시 invalid로 전환된다", async () => {
    // Arrange
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { verified: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "PASSWORD_RESET_SESSION_INVALID", message: "expired" } }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      );
    const { result } = renderHook(() => usePasswordResetFlow("token-hash"), { wrapper });
    await waitFor(() => expect(result.current.step).toBe("newPassword"));

    // Act
    await act(async () => {
      await result.current.actions.submitNewPassword("abcd1234");
    });

    // Assert
    await waitFor(() => expect(result.current.step).toBe("invalid"));
  });

  it("sent에서 backToRequest 호출 시 request로 복귀한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { message: "발송됨" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { result } = renderHook(() => usePasswordResetFlow(null), { wrapper });
    await act(async () => {
      await result.current.actions.submitEmail("user@example.com");
    });
    expect(result.current.step).toBe("sent");

    // Act
    act(() => {
      result.current.actions.backToRequest();
    });

    // Assert
    expect(result.current.step).toBe("request");
  });
});
