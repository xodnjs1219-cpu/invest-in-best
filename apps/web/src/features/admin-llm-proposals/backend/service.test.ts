import { describe, expect, it, vi } from "vitest";
import { adminLlmProposalErrorCodes } from "@/features/admin-llm-proposals/backend/error";
import type { ProposalListRpcRow } from "@/features/admin-llm-proposals/backend/schema";
import {
  approveProposal,
  listProposals,
  rejectProposal,
  type AdminLlmProposalRepositoryDeps,
} from "@/features/admin-llm-proposals/backend/service";

const PROPOSAL_ID = "11111111-1111-4111-8111-111111111111";
const REVIEWER_ID = "99999999-9999-4999-8999-999999999999";

const buildRow = (overrides: Partial<ProposalListRpcRow> = {}): ProposalListRpcRow => ({
  proposal_id: PROPOSAL_ID,
  chain_id: "22222222-2222-4222-8222-222222222222",
  chain_name: "반도체 밸류체인",
  proposal_type: "relation_add",
  status: "pending",
  source_node_id: "33333333-3333-4333-8333-333333333333",
  source_display_name: "삼성전자",
  source_node_kind: "listed_company",
  source_ticker: "005930",
  target_node_id: "44444444-4444-4444-8444-444444444444",
  target_display_name: "SK하이닉스",
  target_node_kind: "listed_company",
  target_ticker: "000660",
  relation_type_id: "55555555-5555-4555-8555-555555555555",
  relation_type_name: "공급",
  relation_type_is_active: true,
  disclosure_id: "66666666-6666-4666-8666-666666666666",
  disclosure_title: "공급계약체결",
  disclosure_date: "2026-07-01",
  disclosure_url: "https://dart.fss.or.kr/x",
  disclosure_source: "dart",
  rationale: "공시 내용에 따르면...",
  based_on_snapshot_id: "77777777-7777-4777-8777-777777777777",
  created_at: "2026-07-01T00:00:00.000Z",
  reviewed_by: null,
  reviewed_at: null,
  resulting_snapshot_id: null,
  is_applicable: true,
  applicability_reason: null,
  ...overrides,
});

const createDeps = (
  overrides?: Partial<AdminLlmProposalRepositoryDeps>,
): AdminLlmProposalRepositoryDeps => ({
  listProposalRows: vi.fn(async () => ({ ok: true as const, rows: [] })),
  approveProposalRpc: vi.fn(async () => ({
    ok: true as const,
    row: { outcome: "approved", conflict_reason: null, resulting_snapshot_id: "snap-1", effective_at: "2026-07-08T00:00:00.000Z" },
  })),
  rejectProposalPending: vi.fn(async () => ({ ok: true as const, updated: { id: PROPOSAL_ID, reviewed_at: "2026-07-08T00:00:00.000Z" } })),
  findProposalStatus: vi.fn(async () => ({ ok: true as const, row: null })),
  ...overrides,
});

describe("listProposals", () => {
  it("21행 수신 시 items 20건 + hasMore=true를 반환한다", async () => {
    // Arrange
    const rows = Array.from({ length: 21 }, (_, i) => buildRow({ proposal_id: `${i}`.padStart(8, "0") + "-1111-4111-8111-111111111111" }));
    const deps = createDeps({ listProposalRows: vi.fn(async () => ({ ok: true as const, rows })) });

    // Act
    const result = await listProposals(deps, { status: "pending", page: 1 });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(20);
      expect(result.data.hasMore).toBe(true);
    }
  });

  it("20행 이하 수신 시 hasMore=false를 반환한다", async () => {
    // Arrange
    const rows = [buildRow()];
    const deps = createDeps({ listProposalRows: vi.fn(async () => ({ ok: true as const, rows })) });

    // Act
    const result = await listProposals(deps, { status: "pending", page: 1 });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasMore).toBe(false);
    }
  });

  it("빈 목록도 200 success를 반환한다(E13)", async () => {
    // Arrange
    const deps = createDeps({ listProposalRows: vi.fn(async () => ({ ok: true as const, rows: [] })) });

    // Act
    const result = await listProposals(deps, { status: "pending", page: 1 });

    // Assert
    expect(result).toMatchObject({ ok: true, data: { items: [], hasMore: false } });
  });

  it("flat row를 중첩 DTO로 정확히 변환한다", async () => {
    // Arrange
    const row = buildRow();
    const deps = createDeps({ listProposalRows: vi.fn(async () => ({ ok: true as const, rows: [row] })) });

    // Act
    const result = await listProposals(deps, { status: "pending", page: 1 });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const item = result.data.items[0];
      expect(item.sourceNode).toEqual({
        nodeId: row.source_node_id,
        displayName: "삼성전자",
        nodeKind: "listed_company",
        ticker: "005930",
      });
      expect(item.targetNode.displayName).toBe("SK하이닉스");
      expect(item.relationType).toEqual({
        relationTypeId: row.relation_type_id,
        name: "공급",
        isActive: true,
      });
      expect(item.disclosure).toEqual({
        disclosureId: row.disclosure_id,
        title: "공급계약체결",
        disclosureDate: "2026-07-01",
        url: "https://dart.fss.or.kr/x",
        source: "dart",
      });
      expect(item.applicability).toEqual({ isApplicable: true, reason: null });
    }
  });

  it("relation_type_id가 NULL이면 relationType:null로 변환한다", async () => {
    // Arrange
    const row = buildRow({
      proposal_type: "relation_delete",
      relation_type_id: null,
      relation_type_name: null,
      relation_type_is_active: null,
    });
    const deps = createDeps({ listProposalRows: vi.fn(async () => ({ ok: true as const, rows: [row] })) });

    // Act
    const result = await listProposals(deps, { status: "pending", page: 1 });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].relationType).toBeNull();
    }
  });

  it("disclosure_id가 NULL이면 disclosure:null로 변환한다", async () => {
    // Arrange
    const row = buildRow({
      disclosure_id: null,
      disclosure_title: null,
      disclosure_date: null,
      disclosure_url: null,
      disclosure_source: null,
    });
    const deps = createDeps({ listProposalRows: vi.fn(async () => ({ ok: true as const, rows: [row] })) });

    // Act
    const result = await listProposals(deps, { status: "pending", page: 1 });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].disclosure).toBeNull();
    }
  });

  it("repository 오류 시 500 PROPOSALS_FETCH_ERROR를 반환한다", async () => {
    // Arrange
    const deps = createDeps({ listProposalRows: vi.fn(async () => ({ ok: false as const, message: "db down" })) });

    // Act
    const result = await listProposals(deps, { status: "pending", page: 1 });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.proposalsFetchError);
    }
  });

  it("Row 스키마 위반 시 500 PROPOSALS_FETCH_ERROR를 반환한다", async () => {
    // Arrange
    const invalidRow = { ...buildRow(), proposal_id: undefined } as unknown as ProposalListRpcRow;
    const deps = createDeps({ listProposalRows: vi.fn(async () => ({ ok: true as const, rows: [invalidRow] })) });

    // Act
    const result = await listProposals(deps, { status: "pending", page: 1 });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.proposalsFetchError);
    }
  });

  it("page=2일 때 offset을 pageSize만큼 적용해 조회한다", async () => {
    // Arrange
    const listProposalRowsMock = vi.fn(async () => ({ ok: true as const, rows: [] }));
    const deps = createDeps({ listProposalRows: listProposalRowsMock });

    // Act
    await listProposals(deps, { status: "approved", page: 2 });

    // Assert
    expect(listProposalRowsMock).toHaveBeenCalledWith({ status: "approved", limit: 21, offset: 20 });
  });
});

describe("approveProposal", () => {
  it("outcome='approved' → 200 success", async () => {
    // Arrange
    const deps = createDeps({
      approveProposalRpc: vi.fn(async () => ({
        ok: true as const,
        row: { outcome: "approved", conflict_reason: null, resulting_snapshot_id: "snap-1", effective_at: "2026-07-08T00:00:00.000Z" },
      })),
    });

    // Act
    const result = await approveProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result).toMatchObject({
      ok: true as const,
      data: { proposalId: PROPOSAL_ID, status: "approved", resultingSnapshotId: "snap-1", effectiveAt: "2026-07-08T00:00:00.000Z" },
    });
  });

  it("outcome='not_found' → 404 PROPOSAL_NOT_FOUND", async () => {
    // Arrange
    const deps = createDeps({
      approveProposalRpc: vi.fn(async () => ({
        ok: true as const,
        row: { outcome: "not_found", conflict_reason: null, resulting_snapshot_id: null, effective_at: null },
      })),
    });

    // Act
    const result = await approveProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.proposalNotFound);
    }
  });

  it("outcome='already_processed' → 409 PROPOSAL_ALREADY_PROCESSED", async () => {
    // Arrange
    const deps = createDeps({
      approveProposalRpc: vi.fn(async () => ({
        ok: true as const,
        row: { outcome: "already_processed", conflict_reason: null, resulting_snapshot_id: null, effective_at: null },
      })),
    });

    // Act
    const result = await approveProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.proposalAlreadyProcessed);
    }
  });

  it("outcome='conflict_invalidated' → 409 PROPOSAL_CONFLICT + details.reason", async () => {
    // Arrange
    const deps = createDeps({
      approveProposalRpc: vi.fn(async () => ({
        ok: true as const,
        row: { outcome: "conflict_invalidated", conflict_reason: "NODE_NOT_FOUND", resulting_snapshot_id: null, effective_at: null },
      })),
    });

    // Act
    const result = await approveProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.proposalConflict);
      expect(result.error.details).toEqual({ reason: "NODE_NOT_FOUND" });
    }
  });

  it("outcome='relation_type_inactive' → 422 RELATION_TYPE_INACTIVE", async () => {
    // Arrange
    const deps = createDeps({
      approveProposalRpc: vi.fn(async () => ({
        ok: true as const,
        row: { outcome: "relation_type_inactive", conflict_reason: null, resulting_snapshot_id: null, effective_at: null },
      })),
    });

    // Act
    const result = await approveProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.relationTypeInactive);
    }
  });

  it("outcome='chain_not_applicable' → 422 CHAIN_NOT_APPLICABLE", async () => {
    // Arrange
    const deps = createDeps({
      approveProposalRpc: vi.fn(async () => ({
        ok: true as const,
        row: { outcome: "chain_not_applicable", conflict_reason: null, resulting_snapshot_id: null, effective_at: null },
      })),
    });

    // Act
    const result = await approveProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.chainNotApplicable);
    }
  });

  it("rpc error → 500 APPROVAL_FAILED", async () => {
    // Arrange
    const deps = createDeps({ approveProposalRpc: vi.fn(async () => ({ ok: false as const, message: "db down" })) });

    // Act
    const result = await approveProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.approvalFailed);
    }
  });

  it("미지 outcome → 500 APPROVAL_FAILED", async () => {
    // Arrange
    const deps = createDeps({
      approveProposalRpc: vi.fn(async () => ({
        ok: true as const,
        row: { outcome: "unexpected_outcome", conflict_reason: null, resulting_snapshot_id: null, effective_at: null },
      })),
    });

    // Act
    const result = await approveProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.approvalFailed);
    }
  });
});

describe("rejectProposal", () => {
  it("갱신 성공 → 200 success", async () => {
    // Arrange
    const deps = createDeps({
      rejectProposalPending: vi.fn(async () => ({
        ok: true as const,
        updated: { id: PROPOSAL_ID, reviewed_at: "2026-07-08T00:00:00.000Z" },
      })),
    });

    // Act
    const result = await rejectProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID, reason: "테스트" });

    // Assert
    expect(result).toMatchObject({
      ok: true as const,
      data: { proposalId: PROPOSAL_ID, status: "rejected", reviewedAt: "2026-07-08T00:00:00.000Z" },
    });
  });

  it("0행 + 미존재 → 404 PROPOSAL_NOT_FOUND", async () => {
    // Arrange
    const deps = createDeps({
      rejectProposalPending: vi.fn(async () => ({ ok: true as const, updated: null })),
      findProposalStatus: vi.fn(async () => ({ ok: true as const, row: null })),
    });

    // Act
    const result = await rejectProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.proposalNotFound);
    }
  });

  it("0행 + 이미 처리(approved) → 409 PROPOSAL_ALREADY_PROCESSED", async () => {
    // Arrange
    const deps = createDeps({
      rejectProposalPending: vi.fn(async () => ({ ok: true as const, updated: null })),
      findProposalStatus: vi.fn(async () => ({ ok: true as const, row: { id: PROPOSAL_ID, status: "approved" } })),
    });

    // Act
    const result = await rejectProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.proposalAlreadyProcessed);
    }
  });

  it("repository 오류 → 500 REJECTION_FAILED", async () => {
    // Arrange
    const deps = createDeps({
      rejectProposalPending: vi.fn(async () => ({ ok: false as const, message: "db down" })),
    });

    // Act
    const result = await rejectProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.rejectionFailed);
    }
  });

  it("findProposalStatus 조회 오류 → 500 REJECTION_FAILED", async () => {
    // Arrange
    const deps = createDeps({
      rejectProposalPending: vi.fn(async () => ({ ok: true as const, updated: null })),
      findProposalStatus: vi.fn(async () => ({ ok: false as const, message: "db down" })),
    });

    // Act
    const result = await rejectProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminLlmProposalErrorCodes.rejectionFailed);
    }
  });

  it("reason이 응답에 포함되지 않고 meta로만 전달된다(R-2)", async () => {
    // Arrange
    const deps = createDeps({
      rejectProposalPending: vi.fn(async () => ({
        ok: true as const,
        updated: { id: PROPOSAL_ID, reviewed_at: "2026-07-08T00:00:00.000Z" },
      })),
    });

    // Act
    const result = await rejectProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID, reason: "비밀 사유" });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result.data)).not.toContain("비밀 사유");
    }
    expect(result.meta).toEqual({ reason: "비밀 사유" });
  });

  it("reason 미지정 시 meta가 없다", async () => {
    // Arrange
    const deps = createDeps({
      rejectProposalPending: vi.fn(async () => ({
        ok: true as const,
        updated: { id: PROPOSAL_ID, reviewed_at: "2026-07-08T00:00:00.000Z" },
      })),
    });

    // Act
    const result = await rejectProposal(deps, { proposalId: PROPOSAL_ID, reviewerId: REVIEWER_ID });

    // Assert
    expect(result.meta).toBeUndefined();
  });
});
