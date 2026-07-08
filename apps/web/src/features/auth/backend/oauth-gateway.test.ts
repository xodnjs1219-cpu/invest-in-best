import { describe, expect, it, vi } from "vitest";
import {
  createAuthorizationUrl,
  exchangeCodeForSession,
  oauthSignOut,
} from "@/features/auth/backend/oauth-gateway";

describe("createAuthorizationUrl", () => {
  it("성공 시 authorizationUrl을 반환하고 skipBrowserRedirect:true로 호출한다", async () => {
    // Arrange
    const signInWithOAuthMock = vi.fn(async () => ({
      data: { url: "https://accounts.google.com/o/oauth2/auth?..." },
      error: null,
    }));
    const client = { auth: { signInWithOAuth: signInWithOAuthMock } };

    // Act
    const result = await createAuthorizationUrl(client as never, {
      provider: "google",
      redirectTo: "https://app.example.com/auth/oauth/google/callback",
    });

    // Assert
    expect(result).toEqual({
      kind: "success",
      authorizationUrl: "https://accounts.google.com/o/oauth2/auth?...",
    });
    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://app.example.com/auth/oauth/google/callback",
        skipBrowserRedirect: true,
      },
    });
  });

  it("5xx/네트워크 오류 시 provider_unavailable을 반환한다", async () => {
    // Arrange
    const client = {
      auth: {
        signInWithOAuth: vi.fn(async () => ({
          data: { url: null },
          error: { status: 500, message: "internal error" },
        })),
      },
    };

    // Act
    const result = await createAuthorizationUrl(client as never, {
      provider: "google",
      redirectTo: "https://app.example.com/auth/oauth/google/callback",
    });

    // Assert
    expect(result).toEqual({ kind: "provider_unavailable", message: "internal error" });
  });

  it("예외 발생 시 provider_unavailable로 흡수한다", async () => {
    // Arrange
    const client = {
      auth: {
        signInWithOAuth: vi.fn(async () => {
          throw new Error("network down");
        }),
      },
    };

    // Act
    const result = await createAuthorizationUrl(client as never, {
      provider: "google",
      redirectTo: "https://app.example.com/auth/oauth/google/callback",
    });

    // Assert
    expect(result).toEqual({ kind: "provider_unavailable", message: "network down" });
  });
});

describe("exchangeCodeForSession", () => {
  it("성공 + 검증된 이메일 → emailVerified:true 사용자 매핑", async () => {
    // Arrange
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
              email: "a@b.com",
              email_confirmed_at: "2026-07-01T00:00:00Z",
              created_at: "2026-07-08T00:00:00Z",
              last_sign_in_at: "2026-07-08T00:00:00Z",
              identities: [{ identity_data: { email_verified: true } }],
            },
          },
          error: null,
        })),
      },
    };

    // Act
    const result = await exchangeCodeForSession(client as never, "auth-code");

    // Assert
    expect(result).toEqual({
      kind: "success",
      user: {
        id: "user-1",
        email: "a@b.com",
        emailVerified: true,
        createdAt: "2026-07-08T00:00:00Z",
        lastSignInAt: "2026-07-08T00:00:00Z",
      },
    });
  });

  it("email_confirmed_at 없음 + identity email_verified:false → emailVerified:false", async () => {
    // Arrange
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
              email: "a@b.com",
              email_confirmed_at: null,
              created_at: "2026-07-08T00:00:00Z",
              last_sign_in_at: null,
              identities: [{ identity_data: { email_verified: false } }],
            },
          },
          error: null,
        })),
      },
    };

    // Act
    const result = await exchangeCodeForSession(client as never, "auth-code");

    // Assert
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.user.emailVerified).toBe(false);
    }
  });

  it("4xx(코드 만료/재사용) → exchange_rejected", async () => {
    // Arrange
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn(async () => ({
          data: { user: null },
          error: { status: 400, code: "invalid_grant", message: "invalid code" },
        })),
      },
    };

    // Act
    const result = await exchangeCodeForSession(client as never, "used-code");

    // Assert
    expect(result).toEqual({ kind: "exchange_rejected", message: "invalid code" });
  });

  it("5xx/타임아웃 → provider_unavailable", async () => {
    // Arrange
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn(async () => ({
          data: { user: null },
          error: { status: 500, message: "gotrue down" },
        })),
      },
    };

    // Act
    const result = await exchangeCodeForSession(client as never, "auth-code");

    // Assert
    expect(result).toEqual({ kind: "provider_unavailable", message: "gotrue down" });
  });

  it("예외(Abort) 발생 시 provider_unavailable로 흡수한다", async () => {
    // Arrange
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn(async () => {
          throw new Error("aborted");
        }),
      },
    };

    // Act
    const result = await exchangeCodeForSession(client as never, "auth-code");

    // Assert
    expect(result).toEqual({ kind: "provider_unavailable", message: "aborted" });
  });
});

describe("oauthSignOut", () => {
  it("내부 실패 시에도 throw하지 않는다", async () => {
    // Arrange
    const client = {
      auth: {
        signOut: vi.fn(async () => {
          throw new Error("signOut failed");
        }),
      },
    };

    // Act & Assert
    await expect(oauthSignOut(client as never)).resolves.toBeUndefined();
  });
});
