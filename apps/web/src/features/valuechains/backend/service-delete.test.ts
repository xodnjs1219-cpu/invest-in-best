import { describe, expect, it, vi } from "vitest";
import { deleteUserChain, type DeleteRepository } from "@/features/valuechains/backend/service";
import { valuechainsErrorCodes } from "@/features/valuechains/backend/error";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHAIN_ID = "22222222-2222-4222-8222-222222222222";

const buildRepo = (overrides: Partial<DeleteRepository> = {}): DeleteRepository => ({
  findChainOwnershipById: vi.fn(async () => ({ id: CHAIN_ID, chain_type: "user", owner_id: USER_ID })),
  deleteUserChainById: vi.fn(async () => ({ ok: true }) as const),
  ...overrides,
});

describe("deleteUserChain", () => {
  it("미존재 체인 → 204 성공(멱등), deleteUserChainById 미호출", async () => {
    // Arrange
    const repo = buildRepo({ findChainOwnershipById: vi.fn(async () => null) });

    // Act
    const result = await deleteUserChain(repo, USER_ID, CHAIN_ID);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(204);
      expect(result.data).toBeNull();
    }
    expect(repo.deleteUserChainById).not.toHaveBeenCalled();
  });

  it("공식 체인(chain_type=official, owner_id=null) → 403 OFFICIAL_CHAIN_DELETE_FORBIDDEN, delete 미호출", async () => {
    // Arrange
    const repo = buildRepo({
      findChainOwnershipById: vi.fn(async () => ({ id: CHAIN_ID, chain_type: "official", owner_id: null })),
    });

    // Act
    const result = await deleteUserChain(repo, USER_ID, CHAIN_ID);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error.code).toBe(valuechainsErrorCodes.officialChainDeleteForbidden);
    }
    expect(repo.deleteUserChainById).not.toHaveBeenCalled();
  });

  it("타인 소유 user 체인 → 403 CHAIN_FORBIDDEN, delete 미호출", async () => {
    // Arrange
    const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
    const repo = buildRepo({
      findChainOwnershipById: vi.fn(async () => ({ id: CHAIN_ID, chain_type: "user", owner_id: OTHER_USER_ID })),
    });

    // Act
    const result = await deleteUserChain(repo, USER_ID, CHAIN_ID);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainForbidden);
    }
    expect(repo.deleteUserChainById).not.toHaveBeenCalled();
  });

  it("owner_id=null인 user 체인(비정상 데이터 방어) → 403 CHAIN_FORBIDDEN", async () => {
    // Arrange
    const repo = buildRepo({
      findChainOwnershipById: vi.fn(async () => ({ id: CHAIN_ID, chain_type: "user", owner_id: null })),
    });

    // Act
    const result = await deleteUserChain(repo, USER_ID, CHAIN_ID);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(valuechainsErrorCodes.chainForbidden);
    }
  });

  it("본인 소유 user 체인 → deleteUserChainById가 정확한 인자로 1회 호출된 후 204", async () => {
    // Arrange
    const repo = buildRepo();

    // Act
    const result = await deleteUserChain(repo, USER_ID, CHAIN_ID);

    // Assert
    expect(repo.deleteUserChainById).toHaveBeenCalledWith(CHAIN_ID, USER_ID);
    expect(repo.deleteUserChainById).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(204);
    }
  });

  it("delete 결과 { ok: false } → 500 INTERNAL_ERROR", async () => {
    // Arrange
    const repo = buildRepo({ deleteUserChainById: vi.fn(async () => ({ ok: false, message: "db down" })) });

    // Act
    const result = await deleteUserChain(repo, USER_ID, CHAIN_ID);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.internalError);
    }
  });

  it("검증 순서: 공식 체인이면서 소유자 불일치인 입력은 OFFICIAL_CHAIN_DELETE_FORBIDDEN이 우선 반환된다", async () => {
    // Arrange — 공식 체인은 owner_id가 항상 null이므로 owner_id는 currentUser와 자연히 불일치
    const repo = buildRepo({
      findChainOwnershipById: vi.fn(async () => ({ id: CHAIN_ID, chain_type: "official", owner_id: null })),
    });

    // Act
    const result = await deleteUserChain(repo, USER_ID, CHAIN_ID);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(valuechainsErrorCodes.officialChainDeleteForbidden);
    }
  });

  it("조회 실패(repository 오류로 reject) → 500 INTERNAL_ERROR, delete 미호출", async () => {
    // Arrange
    const repo = buildRepo({
      findChainOwnershipById: vi.fn(async () => {
        throw new Error("db down");
      }),
    });

    // Act
    const result = await deleteUserChain(repo, USER_ID, CHAIN_ID);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.internalError);
    }
    expect(repo.deleteUserChainById).not.toHaveBeenCalled();
  });
});
