// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewPasswordForm } from "@/features/auth/components/new-password-form";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

describe("NewPasswordForm", () => {
  it("7자 이하 입력 시 필드 오류를 표시하고 제출을 차단한다", async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NewPasswordForm onSubmit={onSubmit} isPending={false} />);

    // Act
    await user.type(screen.getByLabelText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordLabel), "ab1");
    await user.type(
      screen.getByLabelText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordConfirmLabel),
      "ab1",
    );
    await user.click(
      screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.newPasswordSubmitLabel }),
    );

    // Assert
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("확인 값 불일치 시 제출을 차단한다", async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NewPasswordForm onSubmit={onSubmit} isPending={false} />);

    // Act
    await user.type(
      screen.getByLabelText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordLabel),
      "abcd1234",
    );
    await user.type(
      screen.getByLabelText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordConfirmLabel),
      "different1",
    );
    await user.click(
      screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.newPasswordSubmitLabel }),
    );

    // Assert
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("정책 충족 + 일치 시 onSubmit을 1회 호출한다", async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NewPasswordForm onSubmit={onSubmit} isPending={false} />);

    // Act
    await user.type(
      screen.getByLabelText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordLabel),
      "abcd1234",
    );
    await user.type(
      screen.getByLabelText(AUTH_PASSWORD_RESET_MESSAGES.newPasswordConfirmLabel),
      "abcd1234",
    );
    await user.click(
      screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.newPasswordSubmitLabel }),
    );

    // Assert
    expect(onSubmit).toHaveBeenCalledWith("abcd1234");
  });

  it("isPending 중에는 버튼이 비활성화된다", () => {
    // Act
    render(<NewPasswordForm onSubmit={vi.fn()} isPending={true} />);

    // Assert
    expect(
      screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.newPasswordSubmittingLabel }),
    ).toBeDisabled();
  });
});
