// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/components/login-form";
import { AUTH_LOGIN_MESSAGES } from "@/features/auth/constants";

const setUserMock = vi.fn();

vi.mock("@/features/auth/context/current-user-provider", () => ({
  useCurrentUser: () => ({ setUser: setUserMock }),
}));

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const renderForm = (returnTo?: string) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LoginForm returnTo={returnTo} />
    </QueryClientProvider>,
  );
};

describe("LoginForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
    setUserMock.mockClear();
    replaceMock.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("잘못된 이메일 형식 입력 후 제출 시 필드 오류를 표시하고 API를 호출하지 않는다", async () => {
    // Arrange
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.emailLabel), "not-an-email");
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.passwordLabel), "abcd1234");
    await user.click(screen.getByRole("button", { name: AUTH_LOGIN_MESSAGES.submitLabel }));

    // Assert
    expect(await screen.findByText(AUTH_LOGIN_MESSAGES.emailInvalid)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("비밀번호 빈 값 제출 시 필드 오류를 표시한다", async () => {
    // Arrange
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.emailLabel), "user@example.com");
    await user.click(screen.getByRole("button", { name: AUTH_LOGIN_MESSAGES.submitLabel }));

    // Assert
    expect(await screen.findByText(AUTH_LOGIN_MESSAGES.passwordRequired)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("유효 입력 제출 성공 시 setUser 호출 후 returnTo로 이동한다", async () => {
    // Arrange
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ data: { userId: "user-1", email: "user@example.com", role: "user" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const user = userEvent.setup();
    renderForm("/valuechains/new");

    // Act
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.emailLabel), "user@example.com");
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.passwordLabel), "abcd1234");
    await user.click(screen.getByRole("button", { name: AUTH_LOGIN_MESSAGES.submitLabel }));

    // Assert
    await waitFor(() =>
      expect(setUserMock).toHaveBeenCalledWith({
        id: "user-1",
        email: "user@example.com",
        role: "user",
      }),
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/valuechains/new"));
  });

  it("returnTo 미지정 시 성공하면 메인('/')으로 이동한다", async () => {
    // Arrange
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ data: { userId: "user-1", email: "user@example.com", role: "user" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.emailLabel), "user@example.com");
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.passwordLabel), "abcd1234");
    await user.click(screen.getByRole("button", { name: AUTH_LOGIN_MESSAGES.submitLabel }));

    // Assert
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });

  it("returnTo가 외부 URL이면 메인으로 이동한다 (오픈 리다이렉트 방지)", async () => {
    // Arrange
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ data: { userId: "user-1", email: "user@example.com", role: "user" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const user = userEvent.setup();
    renderForm("https://evil.com");

    // Act
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.emailLabel), "user@example.com");
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.passwordLabel), "abcd1234");
    await user.click(screen.getByRole("button", { name: AUTH_LOGIN_MESSAGES.submitLabel }));

    // Assert
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });

  it("자격 증명 오류(401) 시 통일 문구를 표시하고 입력값을 유지한다", async () => {
    // Arrange
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "AUTH_INVALID_CREDENTIALS", message: "invalid" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.emailLabel), "user@example.com");
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.passwordLabel), "wrongpass");
    await user.click(screen.getByRole("button", { name: AUTH_LOGIN_MESSAGES.submitLabel }));

    // Assert
    expect(await screen.findByRole("alert")).toHaveTextContent(
      AUTH_LOGIN_MESSAGES.invalidCredentials,
    );
    expect(screen.getByLabelText(AUTH_LOGIN_MESSAGES.emailLabel)).toHaveValue("user@example.com");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("제출 중 버튼이 비활성화되어 중복 제출을 방지한다", async () => {
    // Arrange
    let resolveFetch: (value: Response) => void = () => {};
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.emailLabel), "user@example.com");
    await user.type(screen.getByLabelText(AUTH_LOGIN_MESSAGES.passwordLabel), "abcd1234");
    await user.click(screen.getByRole("button", { name: AUTH_LOGIN_MESSAGES.submitLabel }));

    // Assert
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: AUTH_LOGIN_MESSAGES.submittingLabel }),
      ).toBeDisabled(),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(
        JSON.stringify({ data: { userId: "user-1", email: "user@example.com", role: "user" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  });
});
