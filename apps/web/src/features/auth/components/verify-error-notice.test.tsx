// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerifyErrorNotice } from "@/features/auth/components/verify-error-notice";
import { AUTH_VERIFY_ERROR_MESSAGES } from "@/features/auth/constants";

describe("VerifyErrorNotice", () => {
  it("무효/만료 안내 문구와 로그인 이동 링크를 표시한다", () => {
    // Act
    render(<VerifyErrorNotice />);

    // Assert
    expect(screen.getByText(AUTH_VERIFY_ERROR_MESSAGES.title)).toBeInTheDocument();
    expect(screen.getByText(AUTH_VERIFY_ERROR_MESSAGES.body)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: AUTH_VERIFY_ERROR_MESSAGES.goToLogin });
    expect(link).toHaveAttribute("href", "/auth/login");
  });
});
