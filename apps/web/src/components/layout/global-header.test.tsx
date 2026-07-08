// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalHeader } from "@/components/layout/global-header";
import { AUTH_LOGOUT_MESSAGES } from "@/features/auth/constants";

const useCurrentUserMock = vi.fn();
const useLogoutMock = vi.fn();

vi.mock("@/features/auth/context/current-user-provider", () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

vi.mock("@/features/auth/hooks/useLogout", () => ({
  useLogout: () => useLogoutMock(),
}));

describe("GlobalHeader", () => {
  it("loading 상태면 스켈레톤을 표시한다", () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "loading", user: null });
    useLogoutMock.mockReturnValue({ logout: vi.fn(), isPending: false });

    // Act
    render(<GlobalHeader />);

    // Assert
    expect(screen.getByTestId("header-skeleton")).toBeInTheDocument();
  });

  it("unauthenticated면 로그인/회원가입 진입점을 표시한다", () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({ status: "unauthenticated", user: null });
    useLogoutMock.mockReturnValue({ logout: vi.fn(), isPending: false });

    // Act
    render(<GlobalHeader />);

    // Assert
    expect(screen.getByRole("link", { name: AUTH_LOGOUT_MESSAGES.loginLabel })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: AUTH_LOGOUT_MESSAGES.signupLabel })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: AUTH_LOGOUT_MESSAGES.logoutLabel })).not.toBeInTheDocument();
  });

  it("authenticated면 UserMenu(로그아웃 버튼 포함)를 표시한다", () => {
    // Arrange
    useCurrentUserMock.mockReturnValue({
      status: "authenticated",
      user: { id: "user-1", email: "user@example.com", role: "user" },
    });
    useLogoutMock.mockReturnValue({ logout: vi.fn(), isPending: false });

    // Act
    render(<GlobalHeader />);

    // Assert
    expect(screen.getByRole("button", { name: AUTH_LOGOUT_MESSAGES.logoutLabel })).toBeInTheDocument();
  });
});
