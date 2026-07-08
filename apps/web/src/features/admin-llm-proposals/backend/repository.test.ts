import { describe, expect, it, vi } from "vitest";
import {
  approveProposalRpc,
  findProposalStatus,
  listProposalRows,
  rejectProposalPending,
} from "@/features/admin-llm-proposals/backend/repository";

describe("listProposalRows", () => {
  it("p_status/p_limit/p_offset 파라미터로 정확히 rpc를 호출하고 행을 반환한다", async () => {
    // Arrange
    const rows = [{ proposal_id: "p-1" }];
    const rpcMock = vi.fn(async () => ({ data: rows, error: null }));
    const client = { rpc: rpcMock };

    // Act
    const result = await listProposalRows(client as never, {
      status: "pending",
      limit: 21,
      offset: 0,
    });

    // Assert
    expect(result).toEqual({ ok: true, rows });
    expect(rpcMock).toHaveBeenCalledWith("list_llm_proposals", {
      p_status: "pending",
      p_limit: 21,
      p_offset: 0,
    });
  });

  it("rpc 오류 시 {ok:false}를 반환한다(throw 없음)", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: null, error: { message: "db error" } })) };

    // Act
    const result = await listProposalRows(client as never, {
      status: "pending",
      limit: 21,
      offset: 0,
    });

    // Assert
    expect(result).toEqual({ ok: false, message: "db error" });
  });

  it("data가 null이면 빈 배열로 취급한다", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: null, error: null })) };

    // Act
    const result = await listProposalRows(client as never, {
      status: "approved",
      limit: 21,
      offset: 20,
    });

    // Assert
    expect(result).toEqual({ ok: true, rows: [] });
  });
});

describe("approveProposalRpc", () => {
  it("p_proposal_id/p_reviewer_id 파라미터로 rpc를 호출하고 단일 행을 반환한다", async () => {
    // Arrange
    const row = { outcome: "approved", conflict_reason: null, resulting_snapshot_id: "s-1", effective_at: "2026-07-08T00:00:00.000Z" };
    const rpcMock = vi.fn(async () => ({ data: [row], error: null }));
    const client = { rpc: rpcMock };

    // Act
    const result = await approveProposalRpc(client as never, {
      proposalId: "proposal-1",
      reviewerId: "reviewer-1",
    });

    // Assert
    expect(result).toEqual({ ok: true, row });
    expect(rpcMock).toHaveBeenCalledWith("approve_llm_proposal", {
      p_proposal_id: "proposal-1",
      p_reviewer_id: "reviewer-1",
    });
  });

  it("rpc 오류 시 {ok:false}를 반환한다", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: null, error: { message: "rpc failed" } })) };

    // Act
    const result = await approveProposalRpc(client as never, {
      proposalId: "proposal-1",
      reviewerId: "reviewer-1",
    });

    // Assert
    expect(result).toEqual({ ok: false, message: "rpc failed" });
  });

  it("data가 빈 배열이면 {ok:false}를 반환한다(예기치 못한 함수 무응답)", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: [], error: null })) };

    // Act
    const result = await approveProposalRpc(client as never, {
      proposalId: "proposal-1",
      reviewerId: "reviewer-1",
    });

    // Assert
    expect(result.ok).toBe(false);
  });
});

describe("rejectProposalPending", () => {
  it("status=pending 조건부 UPDATE를 수행하고 갱신 행을 반환한다(이중 처리 방지 핵심)", async () => {
    // Arrange
    const updatedRow = { id: "proposal-1", reviewed_at: "2026-07-08T00:00:00.000Z" };
    const eqStatusMock = vi.fn(() => ({ select: vi.fn(() => Promise.resolve({ data: [updatedRow], error: null })) }));
    const eqIdMock = vi.fn(() => ({ eq: eqStatusMock }));
    const updateMock = vi.fn(() => ({ eq: eqIdMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const client = { from: fromMock };

    // Act
    const result = await rejectProposalPending(client as never, {
      proposalId: "proposal-1",
      reviewerId: "reviewer-1",
    });

    // Assert
    expect(result).toEqual({ ok: true, updated: updatedRow });
    expect(fromMock).toHaveBeenCalledWith("llm_relation_proposals");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected", reviewed_by: "reviewer-1" }),
    );
    expect(eqIdMock).toHaveBeenCalledWith("id", "proposal-1");
    expect(eqStatusMock).toHaveBeenCalledWith("status", "pending");
  });

  it("갱신 0행이면 {ok:true, updated:null}을 반환한다(throw 없음)", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ select: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
          })),
        })),
      })),
    };

    // Act
    const result = await rejectProposalPending(client as never, {
      proposalId: "proposal-1",
      reviewerId: "reviewer-1",
    });

    // Assert
    expect(result).toEqual({ ok: true, updated: null });
  });

  it("update 오류 시 error 결과를 그대로 전파한다(throw 없음)", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => Promise.resolve({ data: null, error: { message: "update failed" } })),
            })),
          })),
        })),
      })),
    };

    // Act
    const result = await rejectProposalPending(client as never, {
      proposalId: "proposal-1",
      reviewerId: "reviewer-1",
    });

    // Assert
    expect(result).toEqual({ ok: false, message: "update failed" });
  });
});

describe("findProposalStatus", () => {
  it("id/status 단건을 조회한다", async () => {
    // Arrange
    const row = { id: "proposal-1", status: "approved" };
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row, error: null })) })) })),
      })),
    };

    // Act
    const result = await findProposalStatus(client as never, "proposal-1");

    // Assert
    expect(result).toEqual({ ok: true, row });
  });

  it("행이 없으면 {ok:true, row:null}을 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
      })),
    };

    // Act
    const result = await findProposalStatus(client as never, "proposal-1");

    // Assert
    expect(result).toEqual({ ok: true, row: null });
  });

  it("조회 오류 시 {ok:false}를 반환한다", async () => {
    // Arrange
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: { message: "db error" } })) })),
        })),
      })),
    };

    // Act
    const result = await findProposalStatus(client as never, "proposal-1");

    // Assert
    expect(result).toEqual({ ok: false, message: "db error" });
  });
});
