import { describe, expect, it } from "vitest";
import {
  currentUserReducer,
  initialCurrentUserState,
} from "@/features/auth/context/current-user-reducer";

describe("currentUserReducer", () => {
  it("초기 상태는 status='loading'이다", () => {
    // Assert
    expect(initialCurrentUserState).toEqual({ status: "loading", user: null });
  });

  it("SET_USER 액션은 status='authenticated'로 전환하고 user를 저장한다", () => {
    // Arrange
    const user = { id: "user-1", email: "a@b.com", role: "user" as const };

    // Act
    const next = currentUserReducer(initialCurrentUserState, { type: "SET_USER", user });

    // Assert
    expect(next).toEqual({ status: "authenticated", user });
  });

  it("CLEAR_USER 액션은 status='unauthenticated'로 전환하고 user를 null로 만든다", () => {
    // Arrange
    const authenticated = {
      status: "authenticated" as const,
      user: { id: "user-1", email: "a@b.com", role: "user" as const },
    };

    // Act
    const next = currentUserReducer(authenticated, { type: "CLEAR_USER" });

    // Assert
    expect(next).toEqual({ status: "unauthenticated", user: null });
  });
});
