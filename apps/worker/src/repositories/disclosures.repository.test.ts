import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertDisclosures } from "./disclosures.repository";

function makeClient(overrides: Record<string, unknown>): SupabaseClient {
  return overrides as unknown as SupabaseClient;
}

describe("upsertDisclosures", () => {
  it("upserts with onConflict 'source,external_id' (E5 idempotent merge)", async () => {
    const upsertedRows: unknown[] = [];
    const upsertOptions: unknown[] = [];
    const upsert = vi.fn((rows: unknown, options: unknown) => {
      upsertedRows.push(rows);
      upsertOptions.push(options);
      return Promise.resolve({ error: null });
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const result = await upsertDisclosures(client, [
      {
        securityId: "sec-1",
        source: "dart",
        externalId: "20260101000001",
        title: "사업보고서",
        disclosureDate: "2026-01-01",
        url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260101000001",
      },
    ]);

    expect(from).toHaveBeenCalledWith("disclosures");
    expect(upsertedRows[0]).toEqual([
      {
        security_id: "sec-1",
        source: "dart",
        external_id: "20260101000001",
        title: "사업보고서",
        disclosure_date: "2026-01-01",
        url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260101000001",
      },
    ]);
    expect(upsertOptions[0]).toMatchObject({ onConflict: "source,external_id" });
    expect(result.ok).toBe(true);
  });

  it("chunks large row sets by DB_UPSERT_CHUNK_SIZE", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = makeClient({ from });

    const rows = Array.from({ length: 1500 }, (_, i) => ({
      securityId: `sec-${i}`,
      source: "dart" as const,
      externalId: `ext-${i}`,
      title: "t",
      disclosureDate: "2026-01-01",
      url: null,
    }));

    await upsertDisclosures(client, rows);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("is a no-op success for an empty list", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await upsertDisclosures(client, []);
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});
