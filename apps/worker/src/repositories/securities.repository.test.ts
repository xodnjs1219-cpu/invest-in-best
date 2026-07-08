import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findCollectTargets } from "./securities.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("findCollectTargets", () => {
  it("applies market IN, listing_status='listed', and toss_symbol NOT NULL filters", async () => {
    const notFn = vi.fn().mockResolvedValue({
      data: [{ id: "sec-1", toss_symbol: "005930", market: "KRX", currency: "KRW" }],
      error: null,
    });
    const eqFn = vi.fn().mockReturnValue({ not: notFn });
    const inFn = vi.fn().mockReturnValue({ eq: eqFn });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findCollectTargets(client, ["KRX"]);

    expect(from).toHaveBeenCalledWith("securities");
    expect(inFn).toHaveBeenCalledWith("market", ["KRX"]);
    expect(eqFn).toHaveBeenCalledWith("listing_status", "listed");
    expect(notFn).toHaveBeenCalledWith("toss_symbol", "is", null);
    expect(result).toEqual({
      ok: true,
      data: [{ id: "sec-1", tossSymbol: "005930", market: "KRX", currency: "KRW" }],
    });
  });
});
