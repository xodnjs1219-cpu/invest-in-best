import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findNodesBySnapshotIds, findSnapshotsByChain } from "./snapshots.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("findSnapshotsByChain", () => {
  it("filters by effective_at <= untilIso ordered ascending", async () => {
    const orderFn = vi.fn().mockResolvedValue({
      data: [{ id: "snap-1", effective_at: "2026-05-01T00:00:00Z" }],
      error: null,
    });
    const lte = vi.fn().mockReturnValue({ order: orderFn });
    const eq = vi.fn().mockReturnValue({ lte });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findSnapshotsByChain(client, "chain-1", "2026-05-31T23:59:59Z");

    expect(from).toHaveBeenCalledWith("chain_snapshots");
    expect(eq).toHaveBeenCalledWith("chain_id", "chain-1");
    expect(lte).toHaveBeenCalledWith("effective_at", "2026-05-31T23:59:59Z");
    expect(orderFn).toHaveBeenCalledWith("effective_at", { ascending: true });
    expect(result).toEqual({ ok: true, data: [{ id: "snap-1", effectiveAt: "2026-05-01T00:00:00Z" }] });
  });

  it("returns {ok:false} on DB error", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const lte = vi.fn().mockReturnValue({ order: orderFn });
    const eq = vi.fn().mockReturnValue({ lte });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findSnapshotsByChain(client, "chain-1", "2026-05-31T23:59:59Z");
    expect(result.ok).toBe(false);
  });
});

describe("findNodesBySnapshotIds", () => {
  it("separates total node count (m, including free subjects) from listed-company nodes with currency", async () => {
    const rangeFn = vi.fn().mockResolvedValue({
      data: [
        { snapshot_id: "snap-1", node_kind: "listed_company", security_id: "sec-1", securities: { currency: "KRW" } },
        { snapshot_id: "snap-1", node_kind: "free_subject", security_id: null, securities: null },
        { snapshot_id: "snap-1", node_kind: "listed_company", security_id: "sec-2", securities: { currency: "USD" } },
      ],
      error: null,
    });
    const inFn = vi.fn().mockReturnValue({ range: rangeFn });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findNodesBySnapshotIds(client, ["snap-1"]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const summary = result.data.get("snap-1");
      expect(summary?.totalNodeCount).toBe(3);
      expect(summary?.listedNodes).toEqual([
        { securityId: "sec-1", currency: "KRW" },
        { securityId: "sec-2", currency: "USD" },
      ]);
    }
  });

  it("excludes a free-subject row (security_id null) from listedNodes", async () => {
    const rangeFn = vi.fn().mockResolvedValue({
      data: [{ snapshot_id: "snap-1", node_kind: "free_subject", security_id: null, securities: null }],
      error: null,
    });
    const inFn = vi.fn().mockReturnValue({ range: rangeFn });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findNodesBySnapshotIds(client, ["snap-1"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.get("snap-1")?.listedNodes).toEqual([]);
      expect(result.data.get("snap-1")?.totalNodeCount).toBe(1);
    }
  });

  it("returns an empty map without calling the DB when snapshotIds is empty", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await findNodesBySnapshotIds(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: new Map() });
  });

  it("returns {ok:false} on DB error", async () => {
    const rangeFn = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const inFn = vi.fn().mockReturnValue({ range: rangeFn });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findNodesBySnapshotIds(client, ["snap-1"]);
    expect(result.ok).toBe(false);
  });

  it("paginates across pages until a short page is returned", async () => {
    const page0 = Array.from({ length: 1000 }, () => ({
      snapshot_id: "snap-1",
      node_kind: "free_subject" as const,
      security_id: null,
      securities: null,
    }));
    const page1 = [
      { snapshot_id: "snap-1", node_kind: "listed_company" as const, security_id: "sec-1", securities: { currency: "KRW" as const } },
    ];
    const rangeFn = vi
      .fn()
      .mockResolvedValueOnce({ data: page0, error: null })
      .mockResolvedValueOnce({ data: page1, error: null });
    const inFn = vi.fn().mockReturnValue({ range: rangeFn });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findNodesBySnapshotIds(client, ["snap-1"]);
    expect(rangeFn).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.get("snap-1")?.totalNodeCount).toBe(1001);
    }
  });
});
