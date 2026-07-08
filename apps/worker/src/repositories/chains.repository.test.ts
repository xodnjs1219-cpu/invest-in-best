import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findActiveChains, findLatestSnapshotComposition, listActiveOfficialChains } from "./chains.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("findActiveChains", () => {
  it("filters by is_archived=false (E14 — archived chains excluded from new aggregation)", async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: [{ id: "chain-1" }, { id: "chain-2" }], error: null });
    const select = vi.fn().mockReturnValue({ eq: eqFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findActiveChains(client);

    expect(from).toHaveBeenCalledWith("value_chains");
    expect(eqFn).toHaveBeenCalledWith("is_archived", false);
    expect(result).toEqual({ ok: true, data: [{ id: "chain-1" }, { id: "chain-2" }] });
  });

  it("returns {ok:false} on DB error without throwing", async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const select = vi.fn().mockReturnValue({ eq: eqFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findActiveChains(client);
    expect(result.ok).toBe(false);
  });
});

describe("listActiveOfficialChains (UC-030 M10)", () => {
  it("filters by chain_type='official' and is_archived=false (BR-1·E6·E9)", async () => {
    const eq2 = vi.fn().mockResolvedValue({
      data: [{ id: "chain-1", name: "반도체 밸류체인" }],
      error: null,
    });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await listActiveOfficialChains(client);

    expect(from).toHaveBeenCalledWith("value_chains");
    expect(eq1).toHaveBeenCalledWith("chain_type", "official");
    expect(eq2).toHaveBeenCalledWith("is_archived", false);
    expect(result).toEqual({ ok: true, data: [{ id: "chain-1", name: "반도체 밸류체인" }] });
  });

  it("returns {ok:false} on DB error", async () => {
    const eq2 = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await listActiveOfficialChains(client);
    expect(result.ok).toBe(false);
  });
});

describe("findLatestSnapshotComposition (UC-030 M10)", () => {
  function makeMultiTableClient(tables: Record<string, unknown>): SupabaseClient {
    const from = vi.fn((table: string) => tables[table]);
    return makeClient({ from });
  }

  it("loads the latest snapshot (effective_at DESC, created_at DESC, limit 1) plus nodes and edges", async () => {
    const snapshotMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "snap-1", effective_at: "2026-01-01" }, error: null });
    const snapshotLimit = vi.fn().mockReturnValue({ maybeSingle: snapshotMaybeSingle });
    const snapshotOrder2 = vi.fn().mockReturnValue({ limit: snapshotLimit });
    const snapshotOrder1 = vi.fn().mockReturnValue({ order: snapshotOrder2 });
    const snapshotEq = vi.fn().mockReturnValue({ order: snapshotOrder1 });
    const snapshotSelect = vi.fn().mockReturnValue({ eq: snapshotEq });

    const nodesEq = vi.fn().mockResolvedValue({
      data: [
        {
          id: "node-a",
          node_kind: "listed_company",
          security_id: "sec-a",
          subject_name: null,
          subject_type: null,
          securities: { name: "삼성전자", ticker: "005930" },
        },
        {
          id: "node-b",
          node_kind: "free_subject",
          security_id: null,
          subject_name: "자유주체B",
          subject_type: "industry",
          securities: null,
        },
      ],
      error: null,
    });
    const nodesSelect = vi.fn().mockReturnValue({ eq: nodesEq });

    const edgesEq = vi.fn().mockResolvedValue({
      data: [{ id: "edge-1", source_node_id: "node-a", target_node_id: "node-b", relation_type_id: "rel-1" }],
      error: null,
    });
    const edgesSelect = vi.fn().mockReturnValue({ eq: edgesEq });

    const client = makeMultiTableClient({
      chain_snapshots: { select: snapshotSelect },
      snapshot_nodes: { select: nodesSelect },
      snapshot_edges: { select: edgesSelect },
    });

    const result = await findLatestSnapshotComposition(client, "chain-1");

    expect(snapshotEq).toHaveBeenCalledWith("chain_id", "chain-1");
    expect(snapshotOrder1).toHaveBeenCalledWith("effective_at", { ascending: false });
    expect(snapshotOrder2).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(snapshotLimit).toHaveBeenCalledWith(1);
    expect(nodesEq).toHaveBeenCalledWith("snapshot_id", "snap-1");
    expect(edgesEq).toHaveBeenCalledWith("snapshot_id", "snap-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.snapshotId).toBe("snap-1");
    expect(result.data?.nodes).toEqual([
      { nodeId: "node-a", displayName: "삼성전자", nodeKind: "listed_company", securityId: "sec-a" },
      { nodeId: "node-b", displayName: "자유주체B", nodeKind: "free_subject", securityId: null },
    ]);
    expect(result.data?.edges).toEqual([
      { sourceNodeId: "node-a", targetNodeId: "node-b", relationTypeId: "rel-1" },
    ]);
  });

  it("returns {ok:true, data:null} when the chain has zero snapshots (E9 input)", async () => {
    const snapshotMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const snapshotLimit = vi.fn().mockReturnValue({ maybeSingle: snapshotMaybeSingle });
    const snapshotOrder2 = vi.fn().mockReturnValue({ limit: snapshotLimit });
    const snapshotOrder1 = vi.fn().mockReturnValue({ order: snapshotOrder2 });
    const snapshotEq = vi.fn().mockReturnValue({ order: snapshotOrder1 });
    const snapshotSelect = vi.fn().mockReturnValue({ eq: snapshotEq });
    const from = vi.fn().mockReturnValue({ select: snapshotSelect });
    const client = makeClient({ from });

    const result = await findLatestSnapshotComposition(client, "chain-no-snapshot");

    expect(result).toEqual({ ok: true, data: null });
  });

  it("returns {ok:false} when the snapshot query fails", async () => {
    const snapshotMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const snapshotLimit = vi.fn().mockReturnValue({ maybeSingle: snapshotMaybeSingle });
    const snapshotOrder2 = vi.fn().mockReturnValue({ limit: snapshotLimit });
    const snapshotOrder1 = vi.fn().mockReturnValue({ order: snapshotOrder2 });
    const snapshotEq = vi.fn().mockReturnValue({ order: snapshotOrder1 });
    const snapshotSelect = vi.fn().mockReturnValue({ eq: snapshotEq });
    const from = vi.fn().mockReturnValue({ select: snapshotSelect });
    const client = makeClient({ from });

    const result = await findLatestSnapshotComposition(client, "chain-1");
    expect(result.ok).toBe(false);
  });
});
