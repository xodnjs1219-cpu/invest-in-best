// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordResetRequestForm } from "@/features/auth/components/password-reset-request-form";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

describe("PasswordResetRequestForm", () => {
  it("빈 값 제출 시 필드 오류를 표시하고 onSubmit을 호출하지 않는다", async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PasswordResetRequestForm onSubmit={onSubmit} isPending={false} />);

    // Act
    await user.click(
      screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.requestSubmitLabel }),
    );

    // Assert
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("유효 이메일 제출 시 onSubmit을 1회 호출한다", async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PasswordResetRequestForm onSubmit={onSubmit} isPending={false} />);

    // Act
    await user.type(
      screen.getByLabelText(AUTH_PASSWORD_RESET_MESSAGES.requestEmailLabel),
      "user@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.requestSubmitLabel }),
    );

    // Assert
    expect(onSubmit).toHaveBeenCalledWith("user@example.com");
  });

  it("isPending 중에는 버튼이 비활성화된다", () => {
    // Act
    render(<PasswordResetRequestForm onSubmit={vi.fn()} isPending={true} />);

    // Assert
    expect(
      screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.requestSubmittingLabel }),
    ).toBeDisabled();
  });

  it("errorCode=429 전달 시 재시도 안내 문구를 표시한다", () => {
    // Act
    render(
      <PasswordResetRequestForm
        onSubmit={vi.fn()}
        isPending={false}
        errorCode="PASSWORD_RESET_RATE_LIMITED"
      />,
    );

    // Assert
    expect(screen.getByText(AUTH_PASSWORD_RESET_MESSAGES.rateLimited)).toBeInTheDocument();
  });
});
