// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserMenu } from "@/components/layout/user-menu";
import { AUTH_LOGOUT_MESSAGES } from "@/features/auth/constants";

describe("UserMenu", () => {
  it("로그아웃 항목을 노출한다", () => {
    // Act
    render(<UserMenu email="user@example.com" role="user" isLoggingOut={false} onLogout={vi.fn()} />);

    // Assert
    expect(
      screen.getByRole("button", { name: AUTH_LOGOUT_MESSAGES.logoutLabel }),
    ).toBeInTheDocument();
  });

  it("로그아웃 클릭 시 onLogout을 1회 호출하고 즉시 비활성화된다", async () => {
    // Arrange
    const onLogout = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <UserMenu email="user@example.com" role="user" isLoggingOut={false} onLogout={onLogout} />,
    );

    // Act
    await user.click(screen.getByRole("button", { name: AUTH_LOGOUT_MESSAGES.logoutLabel }));
    rerender(
      <UserMenu email="user@example.com" role="user" isLoggingOut={true} onLogout={onLogout} />,
    );

    // Assert
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: AUTH_LOGOUT_MESSAGES.loggingOutLabel }),
    ).toBeDisabled();
  });

  it("role='admin'이면 어드민 메뉴 항목을 노출한다", () => {
    // Act
    render(<UserMenu email="admin@example.com" role="admin" isLoggingOut={false} onLogout={vi.fn()} />);

    // Assert
    expect(screen.getByText(AUTH_LOGOUT_MESSAGES.adminMenuLabel)).toBeInTheDocument();
  });

  it("role='user'면 어드민 메뉴 항목을 노출하지 않는다", () => {
    // Act
    render(<UserMenu email="user@example.com" role="user" isLoggingOut={false} onLogout={vi.fn()} />);

    // Assert
    expect(screen.queryByText(AUTH_LOGOUT_MESSAGES.adminMenuLabel)).not.toBeInTheDocument();
  });

  it("이메일이 /account로 이동하는 링크다", () => {
    // Act
    render(<UserMenu email="user@example.com" role="user" isLoggingOut={false} onLogout={vi.fn()} />);

    // Assert
    expect(screen.getByRole("link", { name: "user@example.com" })).toHaveAttribute(
      "href",
      "/account",
    );
  });
});
