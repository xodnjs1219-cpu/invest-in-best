// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResetSuccessNotice } from "@/features/auth/components/reset-success-notice";
import { AUTH_PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";

describe("ResetSuccessNotice", () => {
  it("성공 문구와 로그인 이동 링크를 표시한다", () => {
    // Act
    render(<ResetSuccessNotice />);

    // Assert
    expect(screen.getByText(AUTH_PASSWORD_RESET_MESSAGES.successTitle)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: AUTH_PASSWORD_RESET_MESSAGES.goToLogin });
    expect(link).toHaveAttribute("href", "/auth/login");
  });
});
