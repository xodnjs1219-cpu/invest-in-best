import { describe, expect, it, vi } from "vitest";
import {
  countAdmins,
  deleteAuthUser,
  findRoleByUserId,
} from "@/features/account/backend/repository";

describe("findRoleByUserId", () => {
  it("행 존재 시 {role}을 반환한다", async () => {
    // Arrange
    const maybeSingleMock = vi.fn(async () => ({ data: { id: "user-1", role: "user" }, error: null }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })),
      })),
    };

    // Act
    const result = await findRoleByUserId(client as never, "user-1");

    // Assert
    expect(result).toEqual({ id: "user-1", role: "user" });
  });

  it("행 없음(null) 시 null을 반환한다", async () => {
    // Arrange
    const maybeSingleMock = vi.fn(async () => ({ data: null, error: null }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })),
      })),
    };

    // Act
    const result = await findRoleByUserId(client as never, "user-1");

    // Assert
    expect(result).toBeNull();
  });

  it("쿼리 오류 시 null을 반환한다(오류 신호)", async () => {
    // Arrange
    const maybeSingleMock = vi.fn(async () => ({ data: null, error: { message: "db error" } }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })),
      })),
    };

    // Act
    const result = await findRoleByUserId(client as never, "user-1");

    // Assert
    expect(result).toBeNull();
  });

  it("Row 스키마 위반(role='superuser') 시 null을 반환한다", async () => {
    // Arrange
    const maybeSingleMock = vi.fn(async () => ({
      data: { id: "user-1", role: "superuser" },
      error: null,
    }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })),
      })),
    };

    // Act
    const result = await findRoleByUserId(client as never, "user-1");

    // Assert
    expect(result).toBeNull();
  });
});

describe("countAdmins", () => {
  it("count 응답을 숫자로 반환한다", async () => {
    // Arrange
    const eqMock = vi.fn(async () => ({ count: 3, error: null }));
    const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqMock })) })) };

    // Act
    const result = await countAdmins(client as never);

    // Assert
    expect(result).toBe(3);
    expect(eqMock).toHaveBeenCalledWith("role", "admin");
  });

  it("DB 오류 시 null을 반환한다(오류 신호)", async () => {
    // Arrange
    const eqMock = vi.fn(async () => ({ count: null, error: { message: "db error" } }));
    const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqMock })) })) };

    // Act
    const result = await countAdmins(client as never);

    // Assert
    expect(result).toBeNull();
  });
});

describe("deleteAuthUser", () => {
  it("성공 시 {deleted:true}를 반환한다", async () => {
    // Arrange
    const deleteUserMock = vi.fn(async () => ({ data: {}, error: null }));
    const client = { auth: { admin: { deleteUser: deleteUserMock } } };

    // Act
    const result = await deleteAuthUser(client as never, "user-1");

    // Assert
    expect(result).toEqual({ deleted: true });
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
  });

  it("user_not_found 오류 시 {deleted:false, reason:'not_found'}를 반환한다(멱등 신호)", async () => {
    // Arrange
    const client = {
      auth: {
        admin: {
          deleteUser: vi.fn(async () => ({
            data: null,
            error: { message: "not found", code: "user_not_found" },
          })),
        },
      },
    };

    // Act
    const result = await deleteAuthUser(client as never, "user-1");

    // Assert
    expect(result).toEqual({ deleted: false, reason: "not_found", message: "not found" });
  });

  it("타임아웃/네트워크 오류 시 {deleted:false, reason:'error'}를 반환한다(원인 메시지 보존)", async () => {
    // Arrange
    const client = {
      auth: {
        admin: {
          deleteUser: vi.fn(async () => {
            throw new Error("aborted");
          }),
        },
      },
    };

    // Act
    const result = await deleteAuthUser(client as never, "user-1");

    // Assert
    expect(result).toEqual({ deleted: false, reason: "error", message: "aborted" });
  });

  it("기타 오류 시 {deleted:false, reason:'error'}를 반환한다", async () => {
    // Arrange
    const client = {
      auth: {
        admin: {
          deleteUser: vi.fn(async () => ({
            data: null,
            error: { message: "internal error", code: "unexpected_failure" },
          })),
        },
      },
    };

    // Act
    const result = await deleteAuthUser(client as never, "user-1");

    // Assert
    expect(result).toEqual({ deleted: false, reason: "error", message: "internal error" });
  });
});
