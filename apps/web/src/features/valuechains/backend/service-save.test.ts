import { describe, expect, it, vi } from "vitest";
import { valuechainsErrorCodes } from "@/features/valuechains/backend/error";
import { SaveRpcError, type ValuechainsSaveRepository } from "@/features/valuechains/backend/repository";
import {
  saveUserChain,
  type SaveUserChainDeps,
  type SaveUserChainInput,
} from "@/features/valuechains/backend/service";
import type { SaveChainRequest } from "@iib/domain";

const CHAIN_ID = "11111111-1111-4111-8111-111111111111";
const SNAPSHOT_ID = "22222222-2222-4222-8222-222222222222";
const SECURITY_ID = "33333333-3333-4333-8333-333333333333";
const RELATION_TYPE_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";

const buildBody = (overrides: Partial<SaveChainRequest> = {}): SaveChainRequest => ({
  name: "나의 체인",
  focusType: "industry",
  focusSecurityId: null,
  baseSnapshotId: null,
  groups: [],
  nodes: [],
  edges: [],
  ...overrides,
});

const RPC_SAVED_RESULT = {
  outcome: "saved",
  chain_id: CHAIN_ID,
  snapshot_id: SNAPSHOT_ID,
  effective_at: "2026-07-08T00:00:00+09:00",
  group_count: 0,
  node_count: 0,
  edge_count: 0,
};

function createSaveRepoMock(overrides: Partial<ValuechainsSaveRepository> = {}): ValuechainsSaveRepository {
  return {
    findChainMetaById: vi.fn().mockResolvedValue(null),
    findLatestSnapshotHeader: vi.fn().mockResolvedValue(null),
    countOwnedUserChains: vi.fn().mockResolvedValue(0),
    existsChainNameForOwner: vi.fn().mockResolvedValue(false),
    saveUserChainViaRpc: vi.fn().mockResolvedValue(RPC_SAVED_RESULT),
    ...overrides,
  };
}

function createDeps(overrides: {
  saveRepo?: Partial<ValuechainsSaveRepository>;
  securitiesFoundIds?: Set<string>;
  relationTypeRows?: unknown[];
} = {}): SaveUserChainDeps {
  return {
    saveRepo: createSaveRepoMock(overrides.saveRepo),
    securitiesRepo: {
      findExistingSecurityIds: vi.fn().mockResolvedValue({ foundIds: overrides.securitiesFoundIds ?? new Set() }),
    },
    relationTypesRepo: {
      findAllRelationTypes: vi.fn().mockResolvedValue({
        rows: overrides.relationTypeRows ?? [
          { id: RELATION_TYPE_ID, is_directed: true, is_active: true },
        ],
        error: null,
      }),
    },
  };
}

describe("saveUserChain", () => {
  it("신규 정상: 검증 전부 통과 → RPC 파라미터 정확(chainId=null, base=null) → 201 + DTO camelCase", async () => {
    const deps = createDeps();
    const input: SaveUserChainInput = { userId: USER_ID, chainId: null, body: buildBody() };

    const result = await saveUserChain(deps, input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(201);
      expect(result.data.chainId).toBe(CHAIN_ID);
      expect(result.data.snapshotId).toBe(SNAPSHOT_ID);
    }
    expect(deps.saveRepo.saveUserChainViaRpc).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: null, baseSnapshotId: null }),
    );
  });

  it("갱신 정상: 소유자·base 일치 → 200, existsChainNameForOwner에 excludeChainId=chainId 전달 확인", async () => {
    const saveRepo = createSaveRepoMock({
      findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "user", owner_id: USER_ID, is_archived: false }),
      findLatestSnapshotHeader: vi.fn().mockResolvedValue({ id: SNAPSHOT_ID }),
    });
    const deps = createDeps({ saveRepo });
    const input: SaveUserChainInput = {
      userId: USER_ID,
      chainId: CHAIN_ID,
      body: buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    };

    const result = await saveUserChain(deps, input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
    }
    expect(deps.saveRepo.existsChainNameForOwner).toHaveBeenCalledWith(USER_ID, "나의 체인", CHAIN_ID);
  });

  it("신규인데 baseSnapshotId 값 존재 → 400 / 갱신인데 null → 400, RPC 미호출", async () => {
    const deps = createDeps();

    const r1 = await saveUserChain(deps, {
      userId: USER_ID,
      chainId: null,
      body: buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.status).toBe(400);

    const r2 = await saveUserChain(deps, {
      userId: USER_ID,
      chainId: CHAIN_ID,
      body: buildBody({ baseSnapshotId: null }),
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(400);

    expect(deps.saveRepo.saveUserChainViaRpc).not.toHaveBeenCalled();
  });

  it("체인 없음/archived → 404, 공식 체인 → 403, 비소유자 → 403 (각각 RPC 미호출)", async () => {
    const notFoundDeps = createDeps({ saveRepo: { findChainMetaById: vi.fn().mockResolvedValue(null) } });
    const r1 = await saveUserChain(notFoundDeps, {
      userId: USER_ID,
      chainId: CHAIN_ID,
      body: buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.status).toBe(404);

    const officialDeps = createDeps({
      saveRepo: {
        findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "official", owner_id: null, is_archived: false }),
      },
    });
    const r2 = await saveUserChain(officialDeps, {
      userId: USER_ID,
      chainId: CHAIN_ID,
      body: buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(403);

    const forbiddenDeps = createDeps({
      saveRepo: {
        findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "user", owner_id: "other-user", is_archived: false }),
      },
    });
    const r3 = await saveUserChain(forbiddenDeps, {
      userId: USER_ID,
      chainId: CHAIN_ID,
      body: buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.status).toBe(403);

    for (const deps of [notFoundDeps, officialDeps, forbiddenDeps]) {
      expect(deps.saveRepo.saveUserChainViaRpc).not.toHaveBeenCalled();
    }
  });

  it("base ≠ 최신 스냅샷 → 409 SAVE_CONFLICT / 갱신 대상 스냅샷 0건 → 409", async () => {
    const staleDeps = createDeps({
      saveRepo: {
        findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "user", owner_id: USER_ID, is_archived: false }),
        findLatestSnapshotHeader: vi.fn().mockResolvedValue({ id: "stale-snapshot" }),
      },
    });
    const r1 = await saveUserChain(staleDeps, {
      userId: USER_ID,
      chainId: CHAIN_ID,
      body: buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.status).toBe(409);

    const noSnapshotDeps = createDeps({
      saveRepo: {
        findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "user", owner_id: USER_ID, is_archived: false }),
        findLatestSnapshotHeader: vi.fn().mockResolvedValue(null),
      },
    });
    const r2 = await saveUserChain(noSnapshotDeps, {
      userId: USER_ID,
      chainId: CHAIN_ID,
      body: buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(409);
  });

  it("소유 50개 + 신규 → 422 CHAIN_LIMIT_EXCEEDED (49개 → 통과, 경계값)", async () => {
    const atLimitDeps = createDeps({ saveRepo: { countOwnedUserChains: vi.fn().mockResolvedValue(50) } });
    const r1 = await saveUserChain(atLimitDeps, { userId: USER_ID, chainId: null, body: buildBody() });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.code).toBe(valuechainsErrorCodes.saveChainLimitExceeded);

    const belowLimitDeps = createDeps({ saveRepo: { countOwnedUserChains: vi.fn().mockResolvedValue(49) } });
    const r2 = await saveUserChain(belowLimitDeps, { userId: USER_ID, chainId: null, body: buildBody() });
    expect(r2.ok).toBe(true);
  });

  it("이름 중복 → 409 DUPLICATE_NAME", async () => {
    const deps = createDeps({ saveRepo: { existsChainNameForOwner: vi.fn().mockResolvedValue(true) } });
    const result = await saveUserChain(deps, { userId: USER_ID, chainId: null, body: buildBody() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.code).toBe(valuechainsErrorCodes.saveDuplicateName);
    }
  });

  it("노드 101개 → 422 NODE_LIMIT_EXCEEDED / listed+securityId null → 422 INVALID_NODE + clientNodeIds / 동일 종목 2노드 → 422 DUPLICATE_SECURITY_NODE", async () => {
    const deps = createDeps();

    const manyNodes = Array.from({ length: 101 }, (_, i) => ({
      clientNodeId: `n${i}`,
      nodeKind: "free_subject" as const,
      securityId: null,
      subjectName: `s${i}`,
      subjectType: "other" as const,
      subjectMemo: null,
      groupClientId: null,
      positionX: 0,
      positionY: 0,
    }));
    const r1 = await saveUserChain(deps, { userId: USER_ID, chainId: null, body: buildBody({ nodes: manyNodes }) });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.code).toBe(valuechainsErrorCodes.saveNodeLimitExceeded);

    const invalidNode = [
      {
        clientNodeId: "n1",
        nodeKind: "listed_company" as const,
        securityId: null,
        subjectName: null,
        subjectType: null,
        subjectMemo: null,
        groupClientId: null,
        positionX: 0,
        positionY: 0,
      },
    ];
    const r2 = await saveUserChain(deps, { userId: USER_ID, chainId: null, body: buildBody({ nodes: invalidNode }) });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.error.code).toBe(valuechainsErrorCodes.saveInvalidNode);
      expect((r2.error.details as { violations: unknown[] }).violations).toBeDefined();
    }

    const dupSecurityNodes = [
      {
        clientNodeId: "n1",
        nodeKind: "listed_company" as const,
        securityId: SECURITY_ID,
        subjectName: null,
        subjectType: null,
        subjectMemo: null,
        groupClientId: null,
        positionX: 0,
        positionY: 0,
      },
      {
        clientNodeId: "n2",
        nodeKind: "listed_company" as const,
        securityId: SECURITY_ID,
        subjectName: null,
        subjectType: null,
        subjectMemo: null,
        groupClientId: null,
        positionX: 0,
        positionY: 0,
      },
    ];
    const dupDeps = createDeps({ securitiesFoundIds: new Set([SECURITY_ID]) });
    const r3 = await saveUserChain(dupDeps, {
      userId: USER_ID,
      chainId: null,
      body: buildBody({ nodes: dupSecurityNodes }),
    });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error.code).toBe(valuechainsErrorCodes.saveDuplicateSecurityNode);
  });

  it("미존재 securityId(노드/focus 각각) → 422 SECURITY_NOT_FOUND + 누락 ID 목록(E11)", async () => {
    const nodeMissingDeps = createDeps({ securitiesFoundIds: new Set() });
    const r1 = await saveUserChain(nodeMissingDeps, {
      userId: USER_ID,
      chainId: null,
      body: buildBody({
        nodes: [
          {
            clientNodeId: "n1",
            nodeKind: "listed_company",
            securityId: SECURITY_ID,
            subjectName: null,
            subjectType: null,
            subjectMemo: null,
            groupClientId: null,
            positionX: 0,
            positionY: 0,
          },
        ],
      }),
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) {
      expect(r1.error.code).toBe(valuechainsErrorCodes.saveSecurityNotFound);
      expect((r1.error.details as { clientNodeIds: string[] }).clientNodeIds).toEqual(["n1"]);
    }

    const focusMissingDeps = createDeps({ securitiesFoundIds: new Set() });
    const r2 = await saveUserChain(focusMissingDeps, {
      userId: USER_ID,
      chainId: null,
      body: buildBody({ focusType: "company", focusSecurityId: SECURITY_ID }),
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.error.code).toBe(valuechainsErrorCodes.saveSecurityNotFound);
      expect((r2.error.details as { field: string }).field).toBe("focusSecurityId");
    }
  });

  it("자기 참조 엣지 → 422 INVALID_EDGE / 미존재 relationTypeId → 422 INVALID_RELATION_TYPE", async () => {
    const nodes = [
      {
        clientNodeId: "n1",
        nodeKind: "free_subject" as const,
        securityId: null,
        subjectName: "a",
        subjectType: "other" as const,
        subjectMemo: null,
        groupClientId: null,
        positionX: 0,
        positionY: 0,
      },
    ];
    const deps = createDeps();
    const r1 = await saveUserChain(deps, {
      userId: USER_ID,
      chainId: null,
      body: buildBody({
        nodes,
        edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n1", relationTypeId: RELATION_TYPE_ID }],
      }),
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.code).toBe(valuechainsErrorCodes.invalidEdge);

    const nodes2 = [
      { ...nodes[0]!, clientNodeId: "n1" },
      { ...nodes[0]!, clientNodeId: "n2", subjectName: "b" },
    ];
    const r2 = await saveUserChain(deps, {
      userId: USER_ID,
      chainId: null,
      body: buildBody({
        nodes: nodes2,
        edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: "missing-rt" }],
      }),
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe(valuechainsErrorCodes.invalidRelationType);
  });

  it("비활성 relationTypeId → 통과(BR-8·S-4)", async () => {
    const nodes = [
      { clientNodeId: "n1", nodeKind: "free_subject" as const, securityId: null, subjectName: "a", subjectType: "other" as const, subjectMemo: null, groupClientId: null, positionX: 0, positionY: 0 },
      { clientNodeId: "n2", nodeKind: "free_subject" as const, securityId: null, subjectName: "b", subjectType: "other" as const, subjectMemo: null, groupClientId: null, positionX: 0, positionY: 0 },
    ];
    const deps = createDeps({ relationTypeRows: [{ id: RELATION_TYPE_ID, is_directed: true, is_active: false }] });
    const result = await saveUserChain(deps, {
      userId: USER_ID,
      chainId: null,
      body: buildBody({
        nodes,
        edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: RELATION_TYPE_ID }],
      }),
    });
    expect(result.ok).toBe(true);
  });

  it("focusType='industry' + focusSecurityId 값 → null로 정규화되어 RPC 전달", async () => {
    const deps = createDeps();
    await saveUserChain(deps, {
      userId: USER_ID,
      chainId: null,
      body: buildBody({ focusType: "industry", focusSecurityId: SECURITY_ID }),
    });
    expect(deps.saveRepo.saveUserChainViaRpc).toHaveBeenCalledWith(
      expect.objectContaining({ focusSecurityId: null }),
    );
  });

  it("RPC SAVE_CONFLICT 토큰 → 409 / 23505 owner_name → 409 / 23505 nodes_security → 422 / unknown → 500 SAVE_FAILED", async () => {
    const conflictDeps = createDeps({ saveRepo: { saveUserChainViaRpc: vi.fn().mockResolvedValue({ ...RPC_SAVED_RESULT, outcome: "save_conflict", chain_id: null, snapshot_id: null, effective_at: null, group_count: null, node_count: null, edge_count: null }) } });
    const r1 = await saveUserChain(conflictDeps, { userId: USER_ID, chainId: null, body: buildBody() });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.status).toBe(409);

    const uniqueViolationDeps = createDeps({
      saveRepo: { saveUserChainViaRpc: vi.fn().mockRejectedValue(new SaveRpcError("dup", "23505")) },
    });
    const r2 = await saveUserChain(uniqueViolationDeps, { userId: USER_ID, chainId: null, body: buildBody() });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(409);

    const unknownErrorDeps = createDeps({
      saveRepo: { saveUserChainViaRpc: vi.fn().mockRejectedValue(new Error("boom")) },
    });
    const r3 = await saveUserChain(unknownErrorDeps, { userId: USER_ID, chainId: null, body: buildBody() });
    expect(r3.ok).toBe(false);
    if (!r3.ok) {
      expect(r3.status).toBe(500);
      expect(r3.error.code).toBe(valuechainsErrorCodes.saveFailed);
    }
  });

  it("검증 실패 경로 전부에서 RPC 호출 0회(mock 호출 수 검증)", async () => {
    const deps = createDeps({ saveRepo: { existsChainNameForOwner: vi.fn().mockResolvedValue(true) } });
    await saveUserChain(deps, { userId: USER_ID, chainId: null, body: buildBody() });
    expect(deps.saveRepo.saveUserChainViaRpc).not.toHaveBeenCalled();
  });

  it("422 응답 details에 위반 client ID 목록 포함(FE 하이라이트 계약)", async () => {
    const deps = createDeps();
    const result = await saveUserChain(deps, {
      userId: USER_ID,
      chainId: null,
      body: buildBody({
        groups: [{ clientGroupId: "g1", name: "  " }],
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const details = result.error.details as { violations: Array<{ targets: { clientGroupIds?: string[] } }> };
      expect(details.violations[0]?.targets.clientGroupIds).toEqual(["g1"]);
    }
  });
});
