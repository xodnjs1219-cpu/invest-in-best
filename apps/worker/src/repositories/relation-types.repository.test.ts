import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listActiveRelationTypes } from "./relation-types.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("listActiveRelationTypes (UC-030 M11)", () => {
  it("applies is_active=true filter (BR-4)", async () => {
    const eqFn = vi.fn().mockResolvedValue({
      data: [{ id: "rel-1", name: "공급", is_directed: true }],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq: eqFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await listActiveRelationTypes(client);

    expect(from).toHaveBeenCalledWith("relation_types");
    expect(eqFn).toHaveBeenCalledWith("is_active", true);
    expect(result).toEqual({
      ok: true,
      data: [{ relationTypeId: "rel-1", name: "공급", isDirected: true }],
    });
  });

  it("returns an empty array when there are zero active relation types (not an error)", async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ eq: eqFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await listActiveRelationTypes(client);
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("returns {ok:false} on DB error without throwing", async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const select = vi.fn().mockReturnValue({ eq: eqFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await listActiveRelationTypes(client);
    expect(result.ok).toBe(false);
  });
});
