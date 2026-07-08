import { describe, expect, it, vi } from "vitest";
import { clearClientAuthState } from "@/features/auth/lib/clear-client-auth-state";

describe("clearClientAuthState", () => {
  it("정상 경로: signOut(local) → clearUser → queryClient.clear가 모두 1회씩 호출된다", async () => {
    // Arrange
    const signOutMock = vi.fn(async () => ({ error: null }));
    const browserClient = { auth: { signOut: signOutMock } };
    const clearUser = vi.fn();
    const queryClient = { clear: vi.fn() };

    // Act
    await clearClientAuthState({ browserClient: browserClient as never, clearUser, queryClient: queryClient as never });

    // Assert
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(clearUser).toHaveBeenCalledTimes(1);
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
  });

  it("signOut이 오류를 던져도 clearUser·queryClient.clear는 수행되고 예외를 전파하지 않는다", async () => {
    // Arrange
    const browserClient = {
      auth: {
        signOut: vi.fn(async () => {
          throw new Error("already signed out");
        }),
      },
    };
    const clearUser = vi.fn();
    const queryClient = { clear: vi.fn() };

    // Act & Assert
    await expect(
      clearClientAuthState({ browserClient: browserClient as never, clearUser, queryClient: queryClient as never }),
    ).resolves.toBeUndefined();
    expect(clearUser).toHaveBeenCalledTimes(1);
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
  });
});
