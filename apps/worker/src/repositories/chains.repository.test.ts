import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findActiveChains } from "./chains.repository";

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
