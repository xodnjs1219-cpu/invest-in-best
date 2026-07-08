// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResetTokenInvalidNotice } from "@/features/auth/components/reset-token-invalid-notice";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

describe("ResetTokenInvalidNotice", () => {
  it("통일 무효 안내 문구를 표시한다", () => {
    // Act
    render(<ResetTokenInvalidNotice onRequestAgain={vi.fn()} />);

    // Assert
    expect(screen.getByText(AUTH_PASSWORD_RESET_MESSAGES.invalidBody)).toBeInTheDocument();
  });

  it("다시 요청 클릭 시 onRequestAgain을 호출한다", async () => {
    // Arrange
    const onRequestAgain = vi.fn();
    const user = userEvent.setup();
    render(<ResetTokenInvalidNotice onRequestAgain={onRequestAgain} />);

    // Act
    await user.click(
      screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.requestAgain }),
    );

    // Assert
    expect(onRequestAgain).toHaveBeenCalledTimes(1);
  });
});
