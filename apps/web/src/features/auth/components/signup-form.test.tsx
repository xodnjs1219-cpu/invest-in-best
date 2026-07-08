// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/features/auth/components/signup-form";
import { AUTH_SIGNUP_MESSAGES } from "@/features/auth/constants";

const renderForm = (onSuccess = vi.fn()) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SignupForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess };
};

const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.emailLabel), "user@example.com");
  await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordLabel), "abcd1234");
  await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordConfirmLabel), "abcd1234");
  await user.click(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.agreeTermsLabel));
  await user.click(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.agreePrivacyLabel));
};

describe("SignupForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("모든 필드 유효 + 약관 2종 체크 후 제출하면 성공 시 onSuccess(email)를 호출한다", async () => {
    // Arrange
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ data: { email: "user@example.com", verificationEmailSent: true } }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const user = userEvent.setup();
    const { onSuccess } = renderForm();

    // Act
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submitLabel }));

    // Assert
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("user@example.com"));
  });

  it("이메일 형식 오류 입력 후 제출 시 필드 오류를 표시하고 제출을 차단한다", async () => {
    // Arrange
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.emailLabel), "not-an-email");
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordLabel), "abcd1234");
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordConfirmLabel), "abcd1234");
    await user.click(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.agreeTermsLabel));
    await user.click(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.agreePrivacyLabel));
    await user.click(screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submitLabel }));

    // Assert
    expect(await screen.findByText(AUTH_SIGNUP_MESSAGES.emailInvalid)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("숫자 없는 비밀번호는 정책 오류를 표시하고 제출을 차단한다", async () => {
    // Arrange
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.emailLabel), "user@example.com");
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordLabel), "abcdefgh");
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordConfirmLabel), "abcdefgh");
    await user.click(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.agreeTermsLabel));
    await user.click(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.agreePrivacyLabel));
    await user.click(screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submitLabel }));

    // Assert
    expect(
      await screen.findByText(AUTH_SIGNUP_MESSAGES.passwordPolicyViolation),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("비밀번호 확인 불일치 시 확인 필드 오류를 표시하고 제출을 차단한다", async () => {
    // Arrange
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.emailLabel), "user@example.com");
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordLabel), "abcd1234");
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordConfirmLabel), "different1");
    await user.click(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.agreeTermsLabel));
    await user.click(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.agreePrivacyLabel));
    await user.click(screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submitLabel }));

    // Assert
    expect(
      await screen.findByText(AUTH_SIGNUP_MESSAGES.passwordConfirmMismatch),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("약관 1종만 체크 시 미체크 항목 오류를 표시하고 제출을 차단한다", async () => {
    // Arrange
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.emailLabel), "user@example.com");
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordLabel), "abcd1234");
    await user.type(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.passwordConfirmLabel), "abcd1234");
    await user.click(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.agreeTermsLabel));
    await user.click(screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submitLabel }));

    // Assert
    expect(await screen.findAllByText(AUTH_SIGNUP_MESSAGES.termsRequired)).not.toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("제출 중 재클릭 시 버튼이 비활성화되어 중복 제출되지 않는다", async () => {
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
    await fillValidForm(user);
    const submitButton = screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submitLabel });
    await user.click(submitButton);

    // Assert: 로딩 중 버튼 비활성화
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submittingLabel }),
      ).toBeDisabled(),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(
        JSON.stringify({ data: { email: "user@example.com", verificationEmailSent: true } }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  });

  it("서버 429 응답 시 폼 상단에 대기 안내를 표시하고 입력값을 유지한다", async () => {
    // Arrange
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "AUTH_RATE_LIMITED", message: "rate limited" } }),
        {
          status: 429,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const user = userEvent.setup();
    renderForm();

    // Act
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submitLabel }));

    // Assert
    expect(await screen.findByRole("alert")).toHaveTextContent(AUTH_SIGNUP_MESSAGES.rateLimited);
    expect(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.emailLabel)).toHaveValue("user@example.com");
  });

  it("서버 5xx 응답 시 재시도 유도 문구를 표시하고 입력값을 유지하며 재제출 가능하다 (E6/E7)", async () => {
    // Arrange
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "AUTH_SIGNUP_FAILED", message: "fail" } }), {
        status: 502,
        headers: { "content-type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    renderForm();

    // Act
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submitLabel }));

    // Assert
    expect(await screen.findByRole("alert")).toHaveTextContent(AUTH_SIGNUP_MESSAGES.temporaryError);
    expect(screen.getByLabelText(AUTH_SIGNUP_MESSAGES.emailLabel)).toHaveValue("user@example.com");
    expect(screen.getByRole("button", { name: AUTH_SIGNUP_MESSAGES.submitLabel })).toBeEnabled();
  });

  it("약관 라벨 링크가 /legal/terms, /legal/privacy를 새 탭으로 연다", () => {
    // Act
    renderForm();

    // Assert
    const termsLink = within(screen.getByTestId("terms-field")).getByRole("link");
    const privacyLink = within(screen.getByTestId("privacy-field")).getByRole("link");
    expect(termsLink).toHaveAttribute("href", "/legal/terms");
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(privacyLink).toHaveAttribute("href", "/legal/privacy");
    expect(privacyLink).toHaveAttribute("target", "_blank");
  });
});
