// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useGoogleOAuthStart } from "@/features/auth/hooks/useGoogleOAuthStart";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useGoogleOAuthStart", () => {
  const originalFetch = global.fetch;
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: assignMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("성공 시 authorizationUrl로 location.assign을 호출한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { authorizationUrl: "https://accounts.google.com/x" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { result } = renderHook(() => useGoogleOAuthStart(), { wrapper });

    // Act
    result.current.mutate(undefined);

    // Assert
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("https://accounts.google.com/x"));
  });

  it("502 오류 시 assign을 호출하지 않는다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "AUTH_OAUTH_START_FAILED", message: "fail" } }),
        { status: 502, headers: { "content-type": "application/json" } },
      ),
    );
    const { result } = renderHook(() => useGoogleOAuthStart(), { wrapper });

    // Act
    result.current.mutate(undefined);

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(assignMock).not.toHaveBeenCalled();
  });
});
