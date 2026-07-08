// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GoogleLoginButton } from "@/features/auth/components/google-login-button";
import { AUTH_OAUTH_MESSAGES } from "@/features/auth/constants";

describe("GoogleLoginButton", () => {
  it("버튼과 약관 동의 고지 문구를 함께 표시한다", () => {
    // Act
    render(<GoogleLoginButton onClick={vi.fn()} isPending={false} />);

    // Assert
    expect(
      screen.getByRole("button", { name: AUTH_OAUTH_MESSAGES.googleButtonLabel }),
    ).toBeInTheDocument();
    expect(screen.getByText(AUTH_OAUTH_MESSAGES.consentNotice)).toBeInTheDocument();
  });

  it("클릭 시 onClick을 1회 호출한다", async () => {
    // Arrange
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<GoogleLoginButton onClick={onClick} isPending={false} />);

    // Act
    await user.click(screen.getByRole("button", { name: AUTH_OAUTH_MESSAGES.googleButtonLabel }));

    // Assert
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("isPending 중에는 버튼이 비활성화된다", () => {
    // Act
    render(<GoogleLoginButton onClick={vi.fn()} isPending={true} />);

    // Assert
    expect(
      screen.getByRole("button", { name: AUTH_OAUTH_MESSAGES.googleButtonLoadingLabel }),
    ).toBeDisabled();
  });

  it("errorMessage 전달 시 경고 문구를 표시한다", () => {
    // Act
    render(<GoogleLoginButton onClick={vi.fn()} isPending={false} errorMessage="일시 오류" />);

    // Assert
    expect(screen.getByText("일시 오류")).toBeInTheDocument();
  });
});
