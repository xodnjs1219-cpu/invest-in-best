// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResetEmailSentNotice } from "@/features/auth/components/reset-email-sent-notice";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

describe("ResetEmailSentNotice", () => {
  it("통일 발송 안내 문구를 표시한다", () => {
    // Act
    render(<ResetEmailSentNotice onBack={vi.fn()} />);

    // Assert
    expect(screen.getByText(AUTH_PASSWORD_RESET_MESSAGES.sentBody)).toBeInTheDocument();
  });

  it("다시 요청 클릭 시 onBack을 호출한다", async () => {
    // Arrange
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<ResetEmailSentNotice onBack={onBack} />);

    // Act
    await user.click(screen.getByRole("button", { name: AUTH_PASSWORD_RESET_MESSAGES.backToRequest }));

    // Assert
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
