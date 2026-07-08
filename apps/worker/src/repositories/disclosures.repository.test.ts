import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listUnanalyzedChunk, markAnalyzed, upsertDisclosures } from "./disclosures.repository";

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

describe("listUnanalyzedChunk (UC-030 M12)", () => {
  it("filters llm_analyzed_at IS NULL, orders by disclosure_date asc + created_at asc, applies range", async () => {
    const range = vi.fn().mockResolvedValue({
      data: [
        {
          id: "disc-1",
          security_id: "sec-1",
          source: "dart",
          external_id: "ext-1",
          title: "제목",
          disclosure_date: "2026-01-01",
          url: "https://example.com",
          securities: { name: "삼성전자", ticker: "005930", market: "KRX" },
        },
      ],
      error: null,
    });
    const order2 = vi.fn().mockReturnValue({ range });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const isFn = vi.fn().mockReturnValue({ order: order1 });
    const select = vi.fn().mockReturnValue({ is: isFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await listUnanalyzedChunk(client, { limit: 1000, offset: 0 });

    expect(from).toHaveBeenCalledWith("disclosures");
    expect(isFn).toHaveBeenCalledWith("llm_analyzed_at", null);
    expect(order1).toHaveBeenCalledWith("disclosure_date", { ascending: true });
    expect(order2).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(range).toHaveBeenCalledWith(0, 999);
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: "disc-1",
          securityId: "sec-1",
          source: "dart",
          externalId: "ext-1",
          title: "제목",
          disclosureDate: "2026-01-01",
          url: "https://example.com",
          securityName: "삼성전자",
          securityTicker: "005930",
          securityMarket: "KRX",
        },
      ],
    });
  });

  it("computes the range offset correctly for a subsequent page", async () => {
    const range = vi.fn().mockResolvedValue({ data: [], error: null });
    const order2 = vi.fn().mockReturnValue({ range });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const isFn = vi.fn().mockReturnValue({ order: order1 });
    const select = vi.fn().mockReturnValue({ is: isFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    await listUnanalyzedChunk(client, { limit: 500, offset: 500 });
    expect(range).toHaveBeenCalledWith(500, 999);
  });

  it("returns {ok:false} on DB error", async () => {
    const range = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const order2 = vi.fn().mockReturnValue({ range });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const isFn = vi.fn().mockReturnValue({ order: order1 });
    const select = vi.fn().mockReturnValue({ is: isFn });
    const from = vi.fn().mockReturnValue({ select });
    const client = makeClient({ from });

    const result = await listUnanalyzedChunk(client, { limit: 1000, offset: 0 });
    expect(result.ok).toBe(false);
  });
});

describe("markAnalyzed (UC-030 M12)", () => {
  it("updates llm_analyzed_at for the given ids in chunks of DB_UPSERT_CHUNK_SIZE", async () => {
    const inFn = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ update });
    const client = makeClient({ from });

    const ids = Array.from({ length: 2_500 }, (_, i) => `disc-${i}`);
    const analyzedAt = "2026-01-01T00:00:00.000Z";
    const result = await markAnalyzed(client, ids, analyzedAt);

    expect(update).toHaveBeenCalledTimes(3); // 1000/1000/500
    expect(update).toHaveBeenCalledWith({ llm_analyzed_at: analyzedAt });
    expect(result.ok).toBe(true);
  });

  it("is a no-op success for an empty list", async () => {
    const from = vi.fn();
    const client = makeClient({ from });
    const result = await markAnalyzed(client, [], "2026-01-01T00:00:00.000Z");
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it("returns {ok:false} when the UPDATE fails (E16 — job counts it as a failure)", async () => {
    const inFn = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const update = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ update });
    const client = makeClient({ from });

    const result = await markAnalyzed(client, ["disc-1"], "2026-01-01T00:00:00.000Z");
    expect(result.ok).toBe(false);
  });
});
