import { describe, expect, it, vi } from "vitest";
import { MAX_CHAINS_PER_USER, MAX_NODES_PER_CHAIN } from "@iib/domain";
import { cloneOfficialChain, type CloneRepository } from "@/features/valuechains/backend/service";
import { valuechainsErrorCodes } from "@/features/valuechains/backend/error";
import { CloneRpcError } from "@/features/valuechains/backend/repository";

const OFFICIAL_CHAIN = {
  id: "11111111-1111-4111-8111-111111111111",
  chain_type: "official",
  name: "반도체",
  focus_type: "industry",
  focus_security_id: null,
  is_archived: false,
} as const;

const SNAPSHOT = { id: "22222222-2222-4222-8222-222222222222", effective_at: "2026-07-01T00:00:00Z" };

const RPC_RESULT = {
  chain_id: "33333333-3333-4333-8333-333333333333",
  snapshot_id: "44444444-4444-4444-8444-444444444444",
  cloned_at: "2026-07-08T09:30:00+09:00",
  group_count: 5,
  node_count: 42,
  edge_count: 57,
};

const USER_ID = "55555555-5555-4555-8555-555555555555";

const buildRepo = (overrides: Partial<CloneRepository> = {}): CloneRepository => ({
  findChainHeaderById: vi.fn(async () => OFFICIAL_CHAIN),
  countChainsByOwner: vi.fn(async () => 0),
  listChainNamesByOwner: vi.fn(async () => []),
  findLatestSnapshot: vi.fn(async () => SNAPSHOT),
  countSnapshotComposition: vi.fn(async () => ({ groupCount: 5, nodeCount: 42, edgeCount: 57 })),
  executeCloneChainRpc: vi.fn(async () => RPC_RESULT),
  ...overrides,
});

describe("cloneOfficialChain", () => {
  it("정상: 유효한 공식 체인 + 스냅샷 존재 + 상한 미만 → 201 성공 DTO", async () => {
    // Arrange
    const repo = buildRepo();

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(201);
      expect(result.data).toEqual({
        chainId: RPC_RESULT.chain_id,
        name: "반도체",
        chainType: "user",
        focusType: "industry",
        focusSecurityId: null,
        sourceChainId: OFFICIAL_CHAIN.id,
        snapshotId: RPC_RESULT.snapshot_id,
        clonedAt: RPC_RESULT.cloned_at,
        nodeCount: 42,
        edgeCount: 57,
        groupCount: 5,
      });
    }
    expect(repo.executeCloneChainRpc).toHaveBeenCalledWith({
      sourceChainId: OFFICIAL_CHAIN.id,
      sourceSnapshotId: SNAPSHOT.id,
      ownerId: USER_ID,
      name: "반도체",
    });
  });

  it("이름 충돌: 기존 이름에 원본명이 존재하면 RPC에 접미어가 부여된 이름을 전달한다", async () => {
    // Arrange
    const repo = buildRepo({ listChainNamesByOwner: vi.fn(async () => ["반도체"]) });

    // Act
    await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(repo.executeCloneChainRpc).toHaveBeenCalledWith(
      expect.objectContaining({ name: "반도체 (2)" }),
    );
  });

  it("원본 부재 → 404 SOURCE_CHAIN_NOT_FOUND, 이후 조회 미호출", async () => {
    // Arrange
    const repo = buildRepo({ findChainHeaderById: vi.fn(async () => null) });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.sourceChainNotFound);
    }
    expect(repo.executeCloneChainRpc).not.toHaveBeenCalled();
  });

  it("원본 보관(is_archived=true) → 404 SOURCE_CHAIN_NOT_FOUND", async () => {
    // Arrange
    const repo = buildRepo({
      findChainHeaderById: vi.fn(async () => ({ ...OFFICIAL_CHAIN, is_archived: true })),
    });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(valuechainsErrorCodes.sourceChainNotFound);
    }
  });

  it("원본이 user 체인 → 422 INVALID_CLONE_SOURCE", async () => {
    // Arrange
    const repo = buildRepo({
      findChainHeaderById: vi.fn(async () => ({ ...OFFICIAL_CHAIN, chain_type: "user" })),
    });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error.code).toBe(valuechainsErrorCodes.invalidCloneSource);
    }
  });

  it(`보유 체인 ${MAX_CHAINS_PER_USER}개 → 409 CHAIN_LIMIT_EXCEEDED`, async () => {
    // Arrange
    const repo = buildRepo({ countChainsByOwner: vi.fn(async () => MAX_CHAINS_PER_USER) });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.code).toBe(valuechainsErrorCodes.chainLimitExceeded);
    }
  });

  it(`보유 체인 ${MAX_CHAINS_PER_USER - 1}개(경계값)는 통과한다`, async () => {
    // Arrange
    const repo = buildRepo({ countChainsByOwner: vi.fn(async () => MAX_CHAINS_PER_USER - 1) });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(true);
  });

  it("스냅샷 없음 → 422 SOURCE_SNAPSHOT_MISSING", async () => {
    // Arrange
    const repo = buildRepo({ findLatestSnapshot: vi.fn(async () => null) });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error.code).toBe(valuechainsErrorCodes.sourceSnapshotMissing);
    }
  });

  it(`노드 수 ${MAX_NODES_PER_CHAIN + 1}(비정상 데이터) → 422 INVALID_CLONE_SOURCE`, async () => {
    // Arrange
    const repo = buildRepo({
      countSnapshotComposition: vi.fn(async () => ({
        groupCount: 1,
        nodeCount: MAX_NODES_PER_CHAIN + 1,
        edgeCount: 1,
      })),
    });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error.code).toBe(valuechainsErrorCodes.invalidCloneSource);
    }
  });

  it(`노드 수 ${MAX_NODES_PER_CHAIN}(경계값)은 통과한다`, async () => {
    // Arrange
    const repo = buildRepo({
      countSnapshotComposition: vi.fn(async () => ({
        groupCount: 1,
        nodeCount: MAX_NODES_PER_CHAIN,
        edgeCount: 1,
      })),
    });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(true);
  });

  it("RPC 23505 1회 → 이름 재조회·재시도 후 성공", async () => {
    // Arrange
    let attempt = 0;
    const listChainNamesByOwner = vi.fn(async () => (attempt === 0 ? [] : ["반도체"]));
    const executeCloneChainRpc = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new CloneRpcError("duplicate", "23505");
      }
      return RPC_RESULT;
    });
    const repo = buildRepo({ listChainNamesByOwner, executeCloneChainRpc });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(true);
    expect(executeCloneChainRpc).toHaveBeenCalledTimes(2);
    expect(listChainNamesByOwner).toHaveBeenCalledTimes(2);
  });

  it("RPC 23505 2회 연속 → 500 CLONE_FAILED", async () => {
    // Arrange
    const executeCloneChainRpc = vi.fn(async () => {
      throw new CloneRpcError("duplicate", "23505");
    });
    const repo = buildRepo({ executeCloneChainRpc });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.cloneFailed);
    }
    expect(executeCloneChainRpc).toHaveBeenCalledTimes(2);
  });

  it("RPC 일반 오류 → 500 CLONE_FAILED", async () => {
    // Arrange
    const executeCloneChainRpc = vi.fn(async () => {
      throw new Error("network down");
    });
    const repo = buildRepo({ executeCloneChainRpc });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.cloneFailed);
    }
    expect(executeCloneChainRpc).toHaveBeenCalledTimes(1);
  });

  it("RPC 결과 스키마 위반(필드 누락) → 500 CLONE_FAILED", async () => {
    // Arrange
    const repo = buildRepo({ executeCloneChainRpc: vi.fn(async () => ({ chain_id: "x" })) });

    // Act
    const result = await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(valuechainsErrorCodes.cloneFailed);
    }
  });

  it("검증 실패 경로(원본 부재)에서 RPC가 호출되지 않는다", async () => {
    // Arrange
    const repo = buildRepo({ findChainHeaderById: vi.fn(async () => null) });

    // Act
    await cloneOfficialChain(repo, USER_ID, OFFICIAL_CHAIN.id);

    // Assert
    expect(repo.executeCloneChainRpc).not.toHaveBeenCalled();
  });
});
