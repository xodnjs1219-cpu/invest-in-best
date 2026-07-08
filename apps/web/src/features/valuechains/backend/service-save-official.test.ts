import { describe, expect, it, vi } from "vitest";
import { valuechainsErrorCodes } from "@/features/valuechains/backend/error";
import { SaveRpcError, type OfficialSaveRepository, type ValuechainsSaveRepository } from "@/features/valuechains/backend/repository";
import {
  createOfficialChain,
  updateOfficialChain,
  type SaveOfficialChainDeps,
} from "@/features/valuechains/backend/service";
import type { SaveOfficialChainRequestBody } from "@/features/valuechains/backend/schema";

const CHAIN_ID = "11111111-1111-4111-8111-111111111111";
const SNAPSHOT_ID = "22222222-2222-4222-8222-222222222222";
const RELATION_TYPE_ID = "44444444-4444-4444-8444-444444444444";
const ADMIN_ID = "66666666-6666-4666-8666-666666666666";

const buildBody = (overrides: Partial<SaveOfficialChainRequestBody> = {}): SaveOfficialChainRequestBody => ({
  name: "공식 체인",
  focusType: "industry",
  focusSecurityId: null,
  baseSnapshotId: null,
  disclosureDate: null,
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

function createOfficialSaveRepoMock(overrides: Partial<OfficialSaveRepository> = {}): OfficialSaveRepository {
  return {
    existsOfficialChainName: vi.fn().mockResolvedValue(false),
    saveOfficialChainRpc: vi.fn().mockResolvedValue(RPC_SAVED_RESULT),
    ...overrides,
  };
}

function createSaveRepoMock(overrides: Partial<ValuechainsSaveRepository> = {}): ValuechainsSaveRepository {
  return {
    findChainMetaById: vi.fn().mockResolvedValue(null),
    findLatestSnapshotHeader: vi.fn().mockResolvedValue(null),
    countOwnedUserChains: vi.fn().mockResolvedValue(0),
    existsChainNameForOwner: vi.fn().mockResolvedValue(false),
    saveUserChainViaRpc: vi.fn(),
    ...overrides,
  } as ValuechainsSaveRepository;
}

function createDeps(overrides: {
  officialSaveRepo?: Partial<OfficialSaveRepository>;
  saveRepo?: Partial<ValuechainsSaveRepository>;
  securitiesFoundIds?: Set<string>;
  relationTypeRows?: unknown[];
  previousEdges?: unknown;
} = {}): SaveOfficialChainDeps {
  return {
    officialSaveRepo: createOfficialSaveRepoMock(overrides.officialSaveRepo),
    saveRepo: createSaveRepoMock(overrides.saveRepo),
    securitiesRepo: {
      findExistingSecurityIds: vi.fn().mockResolvedValue({ foundIds: overrides.securitiesFoundIds ?? new Set() }),
    },
    relationTypesRepo: {
      findAllRelationTypes: vi.fn().mockResolvedValue({
        rows: overrides.relationTypeRows ?? [{ id: RELATION_TYPE_ID, is_directed: true, is_active: true }],
        error: null,
      }),
    },
    findPreviousEdgeIdentities: vi.fn().mockResolvedValue(overrides.previousEdges ?? null),
  };
}

describe("createOfficialChain", () => {
  it("role='user'로 official 생성 → 403 ADMIN_REQUIRED, repository 미호출(E1)", async () => {
    const deps = createDeps();
    const result = await createOfficialChain(deps, { userId: "u1", role: "user" }, buildBody());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error.code).toBe(valuechainsErrorCodes.adminRequired);
    }
    expect(deps.officialSaveRepo.saveOfficialChainRpc).not.toHaveBeenCalled();
  });

  it("focusType='industry' + focusSecurityId 값 → null로 정규화되어 RPC 전달(R-14)", async () => {
    const deps = createDeps();
    await createOfficialChain(
      deps,
      { userId: ADMIN_ID, role: "admin" },
      buildBody({ focusSecurityId: "some-id" }),
    );
    expect(deps.officialSaveRepo.saveOfficialChainRpc).toHaveBeenCalledWith(
      expect.objectContaining({ focusSecurityId: null }),
    );
  });

  it("POST에 baseSnapshotId 값 존재 → 400, RPC 미호출", async () => {
    const deps = createDeps();
    const result = await createOfficialChain(
      deps,
      { userId: ADMIN_ID, role: "admin" },
      buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(deps.officialSaveRepo.saveOfficialChainRpc).not.toHaveBeenCalled();
  });

  it("노드 101개 → 422 NODE_LIMIT_EXCEEDED", async () => {
    const deps = createDeps();
    const nodes = Array.from({ length: 101 }, (_, i) => ({
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
    const result = await createOfficialChain(deps, { userId: ADMIN_ID, role: "admin" }, buildBody({ nodes }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(valuechainsErrorCodes.saveNodeLimitExceeded);
  });

  it("그룹 이름 공백 → 422 GROUP_NAME_REQUIRED(official 세분 코드)", async () => {
    const deps = createDeps();
    const result = await createOfficialChain(
      deps,
      { userId: ADMIN_ID, role: "admin" },
      buildBody({ groups: [{ clientGroupId: "g1", name: "" }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(valuechainsErrorCodes.officialGroupNameRequired);
  });

  it("비활성 관계 종류 신규 엣지 → 422 RELATION_TYPE_INACTIVE_FOR_NEW_EDGE(official variant, E3)", async () => {
    const nodes = [
      { clientNodeId: "n1", nodeKind: "free_subject" as const, securityId: null, subjectName: "a", subjectType: "other" as const, subjectMemo: null, groupClientId: null, positionX: 0, positionY: 0 },
      { clientNodeId: "n2", nodeKind: "free_subject" as const, securityId: null, subjectName: "b", subjectType: "other" as const, subjectMemo: null, groupClientId: null, positionX: 0, positionY: 0 },
    ];
    const deps = createDeps({ relationTypeRows: [{ id: RELATION_TYPE_ID, is_directed: true, is_active: false }] });
    const result = await createOfficialChain(
      deps,
      { userId: ADMIN_ID, role: "admin" },
      buildBody({
        nodes,
        edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: RELATION_TYPE_ID }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(valuechainsErrorCodes.relationTypeInactiveForNewEdge);
  });

  it("이름 중복 사전 확인 → 409 / RPC name_duplicate → 409(레이스 경로)", async () => {
    const preDupDeps = createDeps({ officialSaveRepo: { existsOfficialChainName: vi.fn().mockResolvedValue(true) } });
    const r1 = await createOfficialChain(preDupDeps, { userId: ADMIN_ID, role: "admin" }, buildBody());
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.code).toBe(valuechainsErrorCodes.officialNameDuplicate);

    const raceDeps = createDeps({
      officialSaveRepo: { saveOfficialChainRpc: vi.fn().mockResolvedValue({ ...RPC_SAVED_RESULT, outcome: "name_duplicate", chain_id: null, snapshot_id: null, effective_at: null, group_count: null, node_count: null, edge_count: null }) },
    });
    const r2 = await createOfficialChain(raceDeps, { userId: ADMIN_ID, role: "admin" }, buildBody());
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(409);
  });

  it("검증 통과 시 RPC 파라미터: disclosureDate·createdBy=actor.userId 전달", async () => {
    const deps = createDeps();
    await createOfficialChain(
      deps,
      { userId: ADMIN_ID, role: "admin" },
      buildBody({ disclosureDate: "2026-07-01" }),
    );
    expect(deps.officialSaveRepo.saveOfficialChainRpc).toHaveBeenCalledWith(
      expect.objectContaining({ disclosureDate: "2026-07-01", createdBy: ADMIN_ID, chainId: null }),
    );
  });

  it("RPC outcome 매핑: node_limit_exceeded/chain_not_found/chain_type_mismatch/edge_node_ref_invalid → 정확한 코드", async () => {
    const cases: Array<[string, number, string]> = [
      ["node_limit_exceeded", 422, valuechainsErrorCodes.saveNodeLimitExceeded],
      ["chain_not_found", 404, valuechainsErrorCodes.saveNotFound],
      ["chain_type_mismatch", 404, valuechainsErrorCodes.saveNotFound],
      ["edge_node_ref_invalid", 422, valuechainsErrorCodes.invalidEdge],
    ];
    for (const [outcome, status, code] of cases) {
      const deps = createDeps({
        officialSaveRepo: {
          saveOfficialChainRpc: vi.fn().mockResolvedValue({ ...RPC_SAVED_RESULT, outcome, chain_id: null, snapshot_id: null, effective_at: null, group_count: null, node_count: null, edge_count: null }),
        },
      });
      const result = await createOfficialChain(deps, { userId: ADMIN_ID, role: "admin" }, buildBody());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(status);
        expect(result.error.code).toBe(code);
      }
    }
  });

  it("RPC 예외(23505) → 409 officialNameDuplicate / 그 외 예외 → 500", async () => {
    const uniqueDeps = createDeps({
      officialSaveRepo: { saveOfficialChainRpc: vi.fn().mockRejectedValue(new SaveRpcError("dup", "23505")) },
    });
    const r1 = await createOfficialChain(uniqueDeps, { userId: ADMIN_ID, role: "admin" }, buildBody());
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.status).toBe(409);

    const unknownDeps = createDeps({
      officialSaveRepo: { saveOfficialChainRpc: vi.fn().mockRejectedValue(new Error("boom")) },
    });
    const r2 = await createOfficialChain(unknownDeps, { userId: ADMIN_ID, role: "admin" }, buildBody());
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.status).toBe(500);
      expect(r2.error.code).toBe(valuechainsErrorCodes.saveFailed);
    }
  });
});

describe("updateOfficialChain", () => {
  it("baseSnapshotId 없음 → 400", async () => {
    const deps = createDeps();
    const result = await updateOfficialChain(deps, { userId: ADMIN_ID, role: "admin" }, CHAIN_ID, buildBody());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("체인 없음 → 404 / user 체인(방어적) → 404", async () => {
    const notFoundDeps = createDeps({ saveRepo: { findChainMetaById: vi.fn().mockResolvedValue(null) } });
    const r1 = await updateOfficialChain(
      notFoundDeps,
      { userId: ADMIN_ID, role: "admin" },
      CHAIN_ID,
      buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    );
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.status).toBe(404);

    const userChainDeps = createDeps({
      saveRepo: { findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "user", owner_id: "u1", is_archived: false }) },
    });
    const r2 = await updateOfficialChain(
      userChainDeps,
      { userId: ADMIN_ID, role: "admin" },
      CHAIN_ID,
      buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    );
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(404);
  });

  it("보관 체인 → 409 CHAIN_ARCHIVED, RPC 미호출(E10)", async () => {
    const deps = createDeps({
      saveRepo: {
        findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "official", owner_id: null, is_archived: true }),
      },
    });
    const result = await updateOfficialChain(
      deps,
      { userId: ADMIN_ID, role: "admin" },
      CHAIN_ID,
      buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(valuechainsErrorCodes.chainArchived);
    expect(deps.officialSaveRepo.saveOfficialChainRpc).not.toHaveBeenCalled();
  });

  it("갱신: 직전 스냅샷에 존재하던 비활성 종류 동일 엣지 → 통과(BR-6 기존 엣지 유지)", async () => {
    const nodes = [
      { clientNodeId: "n1", nodeKind: "free_subject" as const, securityId: null, subjectName: "a", subjectType: "other" as const, subjectMemo: null, groupClientId: null, positionX: 0, positionY: 0 },
      { clientNodeId: "n2", nodeKind: "free_subject" as const, securityId: null, subjectName: "b", subjectType: "other" as const, subjectMemo: null, groupClientId: null, positionX: 0, positionY: 0 },
    ];
    const previousEdges = [
      {
        relationTypeId: RELATION_TYPE_ID,
        source: { kind: "free_subject", subjectName: "a", subjectType: "other" },
        target: { kind: "free_subject", subjectName: "b", subjectType: "other" },
      },
    ];
    const deps = createDeps({
      saveRepo: {
        findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "official", owner_id: null, is_archived: false }),
      },
      relationTypeRows: [{ id: RELATION_TYPE_ID, is_directed: true, is_active: false }],
      previousEdges,
    });
    const result = await updateOfficialChain(
      deps,
      { userId: ADMIN_ID, role: "admin" },
      CHAIN_ID,
      buildBody({
        baseSnapshotId: SNAPSHOT_ID,
        nodes,
        edges: [{ clientEdgeId: "e1", sourceClientNodeId: "n1", targetClientNodeId: "n2", relationTypeId: RELATION_TYPE_ID }],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("이름 무변경 갱신 → existsOfficialChainName에 excludeChainId 전달", async () => {
    const deps = createDeps({
      saveRepo: {
        findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "official", owner_id: null, is_archived: false }),
      },
    });
    await updateOfficialChain(
      deps,
      { userId: ADMIN_ID, role: "admin" },
      CHAIN_ID,
      buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    );
    expect(deps.officialSaveRepo.existsOfficialChainName).toHaveBeenCalledWith("공식 체인", CHAIN_ID);
  });

  it("정상 갱신 → 200", async () => {
    const deps = createDeps({
      saveRepo: {
        findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "official", owner_id: null, is_archived: false }),
      },
    });
    const result = await updateOfficialChain(
      deps,
      { userId: ADMIN_ID, role: "admin" },
      CHAIN_ID,
      buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe(200);
  });

  it("RPC save_conflict → 409 SAVE_CONFLICT / chain_archived(레이스) → 409", async () => {
    const conflictDeps = createDeps({
      saveRepo: {
        findChainMetaById: vi.fn().mockResolvedValue({ id: CHAIN_ID, chain_type: "official", owner_id: null, is_archived: false }),
      },
      officialSaveRepo: {
        saveOfficialChainRpc: vi.fn().mockResolvedValue({ ...RPC_SAVED_RESULT, outcome: "save_conflict", chain_id: null, snapshot_id: null, effective_at: null, group_count: null, node_count: null, edge_count: null }),
      },
    });
    const result = await updateOfficialChain(
      conflictDeps,
      { userId: ADMIN_ID, role: "admin" },
      CHAIN_ID,
      buildBody({ baseSnapshotId: SNAPSHOT_ID }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.code).toBe(valuechainsErrorCodes.saveConflict);
    }
  });
});
