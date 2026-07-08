// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignupSuccessNotice } from "@/features/auth/components/signup-success-notice";
import { AUTH_SIGNUP_MESSAGES } from "@/features/auth/constants";

describe("SignupSuccessNotice", () => {
  it("입력 이메일이 포함된 발송 안내 문구를 표시한다", () => {
    // Act
    render(<SignupSuccessNotice email="user@example.com" />);

    // Assert
    expect(screen.getByText(AUTH_SIGNUP_MESSAGES.successTitle)).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
  });

  it("로그인 링크가 redirectTo 쿼리를 유지한 채 /auth/login으로 향한다", () => {
    // Act
    render(<SignupSuccessNotice email="user@example.com" redirectTo="/chains/new" />);

    // Assert
    const link = screen.getByRole("link", { name: AUTH_SIGNUP_MESSAGES.goToLogin });
    expect(link).toHaveAttribute("href", "/auth/login?redirectTo=%2Fchains%2Fnew");
  });

  it("redirectTo 없이도 /auth/login 링크를 렌더링한다", () => {
    render(<SignupSuccessNotice email="user@example.com" />);
    const link = screen.getByRole("link", { name: AUTH_SIGNUP_MESSAGES.goToLogin });
    expect(link).toHaveAttribute("href", "/auth/login");
  });
});
