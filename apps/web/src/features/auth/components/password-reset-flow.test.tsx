// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordResetFlow } from "@/features/auth/components/password-reset-flow";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

const renderFlow = (tokenHash: string | null) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PasswordResetFlow tokenHash={tokenHash} />
    </QueryClientProvider>,
  );
};

describe("PasswordResetFlow", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("tokenHash 없으면 요청 폼을 렌더한다", () => {
    // Act
    renderFlow(null);

    // Assert
    expect(screen.getByText(AUTH_PASSWORD_RESET_MESSAGES.requestTitle)).toBeInTheDocument();
  });

  it("tokenHash 있으면 verifying 스피너 후 새 비밀번호 폼으로 전환한다", async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { verified: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // Act
    renderFlow("token-hash");

    // Assert
    await waitFor(() =>
      expect(screen.getByText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordTitle)).toBeInTheDocument(),
    );
  });

  it("confirm 401 발생 시 무효 안내로 전환된다", async () => {
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
    renderFlow("token-hash");
    await waitFor(() =>
      expect(screen.getByText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordTitle)).toBeInTheDocument(),
    );

    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();

    // Act
    await user.type(screen.getByLabelText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordLabel), "abcd1234");
    await user.type(
      screen.getByLabelText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordConfirmLabel),
      "abcd1234",
    );
    await user.click(
      screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.newPasswordSubmitLabel }),
    );

    // Assert
    await waitFor(() =>
      expect(screen.getByText(AUTH_PASSWORD_RESET_MESSAGES.invalidTitle)).toBeInTheDocument(),
    );
  });
});
