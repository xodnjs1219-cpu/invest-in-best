// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleLoginSection } from "@/features/auth/components/google-login-section";
import { AUTH_OAUTH_MESSAGES } from "@/features/auth/constants";

const renderSection = (redirectPath?: string) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GoogleLoginSection redirectPath={redirectPath} />
    </QueryClientProvider>,
  );
};

describe("GoogleLoginSection", () => {
  const originalFetch = global.fetch;
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    global.fetch = vi.fn();
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

  it("버튼 클릭 시 redirectPath를 포함해 start API를 호출한다", async () => {
    // Arrange
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ data: { authorizationUrl: "https://accounts.google.com/x" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderSection("/valuechains/new");

    // Act
    await user.click(
      screen.getByRole("button", { name: AUTH_OAUTH_MESSAGES.googleButtonLabel }),
    );

    // Assert
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("https://accounts.google.com/x"));
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body as string)).toEqual({ redirectPath: "/valuechains/new" });
  });
});
