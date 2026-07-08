import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertPendingProposal, listPendingKeys } from "./llm-proposals.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("listPendingKeys (UC-030 M13)", () => {
  it("filters status=pending and chain_id IN, selecting the 5 dedupe-key columns", async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: [
        {
          chain_id: "chain-1",
          source_node_id: "node-a",
          target_node_id: "node-b",
          relation_type_id: "rel-1",
          proposal_type: "relation_add",
        },
      ],
      error: null,
    });
    const eqFn = vi.fn().mockReturnValue({ in: inFn });
    const select = vi.fn().mockReturnValue({ eq: eqFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await listPendingKeys(client, ["chain-1"]);

    expect(from).toHaveBeenCalledWith("llm_relation_proposals");
    expect(eqFn).toHaveBeenCalledWith("status", "pending");
    expect(inFn).toHaveBeenCalledWith("chain_id", ["chain-1"]);
    expect(result).toEqual({
      ok: true,
      data: [
        {
          chainId: "chain-1",
          sourceNodeId: "node-a",
          targetNodeId: "node-b",
          relationTypeId: "rel-1",
          proposalType: "relation_add",
        },
      ],
    });
  });

  it("is a no-op success for an empty chainIds list", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await listPendingKeys(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("returns {ok:false} on DB error", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const eqFn = vi.fn().mockReturnValue({ in: inFn });
    const select = vi.fn().mockReturnValue({ eq: eqFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await listPendingKeys(client, ["chain-1"]);
    expect(result.ok).toBe(false);
  });
});

describe("insertPendingProposal (UC-030 M13)", () => {
  const row = {
    chainId: "chain-1",
    basedOnSnapshotId: "snap-1",
    proposalType: "relation_add" as const,
    sourceNodeId: "node-a",
    targetNodeId: "node-b",
    relationTypeId: "rel-1",
    disclosureId: "disc-1",
    rationale: "근거 설명",
  };

  it("inserts a camelCase row as a snake_case payload with status='pending'", async () => {
    const insertedPayloads: unknown[] = [];
    const insert = vi.fn((payload: unknown) => {
      insertedPayloads.push(payload);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ insert });
    const client = makeClient({ from });

    const result = await insertPendingProposal(client, row);

    expect(from).toHaveBeenCalledWith("llm_relation_proposals");
    expect(insertedPayloads[0]).toEqual({
      chain_id: "chain-1",
      based_on_snapshot_id: "snap-1",
      proposal_type: "relation_add",
      source_node_id: "node-a",
      target_node_id: "node-b",
      relation_type_id: "rel-1",
      disclosure_id: "disc-1",
      rationale: "근거 설명",
      status: "pending",
    });
    expect(result).toEqual({ ok: true, inserted: true });
  });

  it("treats a 23505 unique violation as a non-error skip (E5 merge, R-5)", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const from = vi.fn().mockReturnValue({ insert });
    const client = makeClient({ from });

    const result = await insertPendingProposal(client, row);
    expect(result).toEqual({ ok: true, inserted: false });
  });

  it("propagates other DB errors as {ok:false}", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23503", message: "fk violation" } });
    const from = vi.fn().mockReturnValue({ insert });
    const client = makeClient({ from });

    const result = await insertPendingProposal(client, row);
    expect(result.ok).toBe(false);
  });
});
