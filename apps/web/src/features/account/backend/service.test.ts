import { describe, expect, it, vi } from "vitest";
import { withdrawAccount, type AccountRepositoryDeps } from "@/features/account/backend/service";
import { accountErrorCodes } from "@/features/account/backend/error";

const createDeps = (overrides?: Partial<AccountRepositoryDeps>): AccountRepositoryDeps => ({
  findRoleByUserId: vi.fn(async () => ({ id: "user-1", role: "user" as const })),
  countAdmins: vi.fn(async () => 2),
  deleteAuthUser: vi.fn(async () => ({ deleted: true as const })),
  ...overrides,
});

describe("withdrawAccount 서비스 (UC-006)", () => {
  it("role=user → deleteAuthUser 호출되고 success({userId, withdrawnAt}) 반환, countAdmins 미호출", async () => {
    // Arrange
    const deps = createDeps();

    // Act
    const result = await withdrawAccount({} as never, deps, "user-1");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe("user-1");
      expect(result.data.withdrawnAt).toEqual(expect.any(String));
    }
    expect(deps.countAdmins).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("role=admin & adminCount=2 → 삭제 진행, 성공 DTO 반환", async () => {
    // Arrange
    const deps = createDeps({
      findRoleByUserId: vi.fn(async () => ({ id: "admin-1", role: "admin" as const })),
      countAdmins: vi.fn(async () => 2),
    });

    // Act
    const result = await withdrawAccount({} as never, deps, "admin-1");

    // Assert
    expect(result.ok).toBe(true);
    expect(deps.deleteAuthUser).toHaveBeenCalled();
  });

  it("role=admin & adminCount=1 → 409 SOLE_ADMIN_WITHDRAWAL_BLOCKED, deleteAuthUser 미호출", async () => {
    // Arrange
    const deps = createDeps({
      findRoleByUserId: vi.fn(async () => ({ id: "admin-1", role: "admin" as const })),
      countAdmins: vi.fn(async () => 1),
    });

    // Act
    const result = await withdrawAccount({} as never, deps, "admin-1");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.code).toBe(accountErrorCodes.soleAdminBlocked);
    }
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("프로필 부재(null) → 500 ACCOUNT_VALIDATION_ERROR, 삭제 미호출", async () => {
    // Arrange
    const deps = createDeps({ findRoleByUserId: vi.fn(async () => null) });

    // Act
    const result = await withdrawAccount({} as never, deps, "user-1");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(accountErrorCodes.validationError);
    }
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("countAdmins가 null(오류 신호) → 500 ACCOUNT_VALIDATION_ERROR", async () => {
    // Arrange
    const deps = createDeps({
      findRoleByUserId: vi.fn(async () => ({ id: "admin-1", role: "admin" as const })),
      countAdmins: vi.fn(async () => null),
    });

    // Act
    const result = await withdrawAccount({} as never, deps, "admin-1");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(accountErrorCodes.validationError);
    }
  });

  it("deleteAuthUser → not_found → 멱등 성공 DTO 반환", async () => {
    // Arrange
    const deps = createDeps({
      deleteAuthUser: vi.fn(async () => ({
        deleted: false as const,
        reason: "not_found" as const,
        message: "already deleted",
      })),
    });

    // Act
    const result = await withdrawAccount({} as never, deps, "user-1");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe("user-1");
    }
  });

  it("deleteAuthUser → error → 500 ACCOUNT_WITHDRAWAL_FAILED", async () => {
    // Arrange
    const deps = createDeps({
      deleteAuthUser: vi.fn(async () => ({
        deleted: false as const,
        reason: "error" as const,
        message: "db down",
      })),
    });

    // Act
    const result = await withdrawAccount({} as never, deps, "user-1");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(accountErrorCodes.withdrawalFailed);
    }
  });

  it("성공 DTO의 withdrawnAt이 유효한 ISO8601이고 userId가 요청 userId와 동일하다", async () => {
    // Arrange
    const deps = createDeps();

    // Act
    const result = await withdrawAccount({} as never, deps, "user-42");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe("user-42");
      expect(() => new Date(result.data.withdrawnAt).toISOString()).not.toThrow();
    }
  });
});
