import { describe, expect, it, vi } from "vitest";
import { adminChainErrorCodes } from "@/features/admin-valuechains/backend/error";
import type { AdminValuechainsRepository, OfficialChainMetaRow } from "@/features/admin-valuechains/backend/repository";
import { archiveChain, listAdminChains } from "@/features/admin-valuechains/backend/service";

const CHAIN_ID = "11111111-1111-4111-8111-111111111111";

const ACTIVE_ROW = {
  chain_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "활성 체인",
  focus_type: "industry",
  focus_security_id: null,
  is_archived: false,
  created_at: "2026-06-01T00:00:00+09:00",
  updated_at: "2026-07-05T09:00:00+09:00",
  latest_snapshot_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  latest_effective_at: "2026-07-05T09:00:00+09:00",
  latest_change_source: "admin_edit",
  node_count: 42,
};

const ARCHIVED_ROW = {
  ...ACTIVE_ROW,
  chain_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "보관 체인",
  is_archived: true,
};

const NO_SNAPSHOT_ROW = {
  ...ACTIVE_ROW,
  chain_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "스냅샷 없음",
  latest_snapshot_id: null,
  latest_effective_at: null,
  latest_change_source: null,
  node_count: 0,
};

function createRepo(overrides: Partial<AdminValuechainsRepository> = {}): AdminValuechainsRepository {
  return {
    listOfficialChains: vi.fn().mockResolvedValue({ ok: true, rows: [ACTIVE_ROW, ARCHIVED_ROW] }),
    findOfficialChainById: vi.fn().mockResolvedValue({ ok: true, row: null }),
    archiveOfficialChainById: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe("listAdminChains", () => {
  it("보관 1건+활성 2건 rows → includeArchived=true면 3건 / false면 2건", async () => {
    const repo = createRepo({
      listOfficialChains: vi.fn().mockResolvedValue({ ok: true, rows: [ACTIVE_ROW, ARCHIVED_ROW, NO_SNAPSHOT_ROW] }),
    });
    const includeAll = await listAdminChains(repo, { includeArchived: true });
    expect(includeAll.ok).toBe(true);
    if (includeAll.ok) expect(includeAll.data.chains).toHaveLength(3);

    const excludeArchived = await listAdminChains(repo, { includeArchived: false });
    expect(excludeArchived.ok).toBe(true);
    if (excludeArchived.ok) expect(excludeArchived.data.chains).toHaveLength(2);
  });

  it("스냅샷 없는 체인 행 → latestSnapshot: null DTO(방어)", async () => {
    const repo = createRepo({ listOfficialChains: vi.fn().mockResolvedValue({ ok: true, rows: [NO_SNAPSHOT_ROW] }) });
    const result = await listAdminChains(repo, { includeArchived: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.chains[0]?.latestSnapshot).toBeNull();
  });

  it("flat Row→중첩 DTO 매핑 정확(node_count→latestSnapshot.nodeCount 등)", async () => {
    const repo = createRepo({ listOfficialChains: vi.fn().mockResolvedValue({ ok: true, rows: [ACTIVE_ROW] }) });
    const result = await listAdminChains(repo, { includeArchived: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chains[0]).toMatchObject({
        chainId: ACTIVE_ROW.chain_id,
        name: "활성 체인",
        isArchived: false,
        latestSnapshot: {
          snapshotId: ACTIVE_ROW.latest_snapshot_id,
          effectiveAt: ACTIVE_ROW.latest_effective_at,
          changeSource: "admin_edit",
          nodeCount: 42,
        },
      });
    }
  });

  it("공식 체인 0건 → 200 + chains: []", async () => {
    const repo = createRepo({ listOfficialChains: vi.fn().mockResolvedValue({ ok: true, rows: [] }) });
    const result = await listAdminChains(repo, { includeArchived: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.chains).toEqual([]);
  });

  it("repository 오류 → 500 LIST_FAILED", async () => {
    const repo = createRepo({ listOfficialChains: vi.fn().mockResolvedValue({ ok: false, message: "db error" }) });
    const result = await listAdminChains(repo, { includeArchived: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminChainErrorCodes.listFailed);
    }
  });
});

describe("archiveChain", () => {
  it("미존재 → 404 CHAIN_NOT_FOUND", async () => {
    const repo = createRepo({ findOfficialChainById: vi.fn().mockResolvedValue({ ok: true, row: null }) });
    const result = await archiveChain(repo, CHAIN_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(adminChainErrorCodes.chainNotFound);
    }
  });

  it("user 체인 → 404(R-7 — 어드민 보관 API는 공식 체인 한정)", async () => {
    const userRow: OfficialChainMetaRow = { id: CHAIN_ID, chain_type: "user", is_archived: false };
    const repo = createRepo({ findOfficialChainById: vi.fn().mockResolvedValue({ ok: true, row: userRow }) });
    const result = await archiveChain(repo, CHAIN_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("이미 보관 → 200 멱등 + UPDATE 미호출(E8)", async () => {
    const archivedRow: OfficialChainMetaRow = { id: CHAIN_ID, chain_type: "official", is_archived: true };
    const repo = createRepo({ findOfficialChainById: vi.fn().mockResolvedValue({ ok: true, row: archivedRow }) });
    const result = await archiveChain(repo, CHAIN_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.data.isArchived).toBe(true);
    }
    expect(repo.archiveOfficialChainById).not.toHaveBeenCalled();
  });

  it("정상 → UPDATE 1회 + 200", async () => {
    const activeRow: OfficialChainMetaRow = { id: CHAIN_ID, chain_type: "official", is_archived: false };
    const repo = createRepo({ findOfficialChainById: vi.fn().mockResolvedValue({ ok: true, row: activeRow }) });
    const result = await archiveChain(repo, CHAIN_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ chainId: CHAIN_ID, isArchived: true });
    expect(repo.archiveOfficialChainById).toHaveBeenCalledWith(CHAIN_ID);
  });

  it("repository 오류 → 각 500 코드", async () => {
    const activeRow: OfficialChainMetaRow = { id: CHAIN_ID, chain_type: "official", is_archived: false };
    const repo = createRepo({
      findOfficialChainById: vi.fn().mockResolvedValue({ ok: true, row: activeRow }),
      archiveOfficialChainById: vi.fn().mockResolvedValue({ ok: false, message: "db error" }),
    });
    const result = await archiveChain(repo, CHAIN_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminChainErrorCodes.archiveFailed);
    }
  });
});
