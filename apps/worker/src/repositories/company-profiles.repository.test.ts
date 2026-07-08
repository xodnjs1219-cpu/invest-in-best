import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findProfileFreshness, upsertProfiles } from "./company-profiles.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("upsertProfiles", () => {
  it("upserts on the security_id PK and stamps last_collected_at", async () => {
    const upsertedRows: unknown[] = [];
    const upsert = vi.fn((rows: unknown) => {
      upsertedRows.push(rows);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertProfiles(client, [
      {
        securityId: "sec-1",
        representativeName: "홍길동",
        establishedDate: "1969-01-13",
        homepageUrl: "www.samsung.com",
        sector: null,
        industryCode: "264",
        address: "경기도 수원시",
        phone: "02-1234-5678",
      },
    ]);

    expect(from).toHaveBeenCalledWith("company_profiles");
    const rows = upsertedRows[0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ security_id: "sec-1", representative_name: "홍길동" });
    expect(rows[0]).toHaveProperty("last_collected_at");
    expect(result.ok).toBe(true);
  });

  it("is a no-op success for an empty list", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await upsertProfiles(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

describe("findProfileFreshness", () => {
  it("selects security_id and last_collected_at for the given ids", async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: [{ security_id: "sec-1", last_collected_at: "2026-01-01T00:00:00Z" }],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await findProfileFreshness(client, ["sec-1", "sec-2"]);

    expect(from).toHaveBeenCalledWith("company_profiles");
    expect(inFn).toHaveBeenCalledWith("security_id", ["sec-1", "sec-2"]);
    expect(result).toEqual({
      ok: true,
      data: [{ securityId: "sec-1", lastCollectedAt: "2026-01-01T00:00:00Z" }],
    });
  });
});
