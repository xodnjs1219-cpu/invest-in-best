// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OAuthCallbackView } from "@/features/auth/components/oauth-callback-view";

describe("OAuthCallbackView", () => {
  it("phase='processing'이면 처리 중 문구만 표시한다", () => {
    // Act
    render(<OAuthCallbackView phase="processing" />);

    // Assert
    expect(screen.getByText("로그인 처리 중...")).toBeInTheDocument();
  });

  it("AUTH_OAUTH_EXCHANGE_FAILED면 인증 거부 문구 + 재시도 링크를 표시한다", () => {
    // Act
    render(<OAuthCallbackView phase="error" errorCode="AUTH_OAUTH_EXCHANGE_FAILED" />);

    // Assert
    expect(screen.getByText(/인증이 거부되었습니다/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/auth/login");
  });

  it("AUTH_OAUTH_EMAIL_UNVERIFIED면 이메일 가입 안내를 표시한다", () => {
    // Act
    render(<OAuthCallbackView phase="error" errorCode="AUTH_OAUTH_EMAIL_UNVERIFIED" />);

    // Assert
    expect(screen.getByRole("link")).toHaveAttribute("href", "/auth/signup");
  });

  it("AUTH_OAUTH_PROVIDER_ERROR면 이메일 로그인 대체 링크를 표시한다", () => {
    // Act
    render(<OAuthCallbackView phase="error" errorCode="AUTH_OAUTH_PROVIDER_ERROR" />);

    // Assert
    expect(screen.getByRole("link")).toHaveAttribute("href", "/auth/login");
  });

  it("알 수 없는 코드는 일반 오류 문구를 표시한다", () => {
    // Act
    render(<OAuthCallbackView phase="error" errorCode="UNKNOWN_CODE" />);

    // Assert
    expect(screen.getByRole("link")).toHaveAttribute("href", "/auth/login");
  });
});
