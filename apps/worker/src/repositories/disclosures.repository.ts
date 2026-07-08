/**
 * 공시 리포지토리 (docs/usecases/027/plan.md 모듈 12, docs/usecases/030/plan.md 모듈 12 확장).
 * disclosures 청크 UPSERT(onConflict:'source,external_id') — E5 멱등(정정 공시는 동일 키 갱신 반영).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_UPSERT_CHUNK_SIZE } from "@iib/domain";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface DisclosureRow {
  securityId: string;
  source: "dart" | "sec" | "toss";
  externalId: string;
  title: string;
  disclosureDate: string;
  url: string | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function upsertDisclosures(
  client: SupabaseClient,
  rows: DisclosureRow[],
): Promise<RepoResult<void>> {
  if (rows.length === 0) return repoOk(undefined);

  for (const c of chunk(rows, DB_UPSERT_CHUNK_SIZE)) {
    const { error } = await client.from("disclosures").upsert(
      c.map((row) => ({
        security_id: row.securityId,
        source: row.source,
        external_id: row.externalId,
        title: row.title,
        disclosure_date: row.disclosureDate,
        url: row.url,
      })),
      { onConflict: "source,external_id" },
    );
    if (error) {
      return repoFail(`upsertDisclosures failed: ${error.message}`);
    }
  }
  return repoOk(undefined);
}

/* ── UC-030(analyze-disclosures) 확장 (docs/usecases/030/plan.md 모듈 12) ── */

export interface UnanalyzedDisclosure {
  id: string;
  securityId: string;
  source: "dart" | "sec" | "toss";
  externalId: string;
  title: string;
  disclosureDate: string;
  url: string | null;
  securityName: string;
  securityTicker: string;
  securityMarket: string;
}

interface UnanalyzedDisclosureRow {
  id: string;
  security_id: string;
  source: "dart" | "sec" | "toss";
  external_id: string;
  title: string;
  disclosure_date: string;
  url: string | null;
  securities: { name: string; ticker: string; market: string } | { name: string; ticker: string; market: string }[];
}

function extractSecurityJoin(
  securities: UnanalyzedDisclosureRow["securities"],
): { name: string; ticker: string; market: string } | null {
  if (Array.isArray(securities)) return securities[0] ?? null;
  return securities;
}

export interface ListUnanalyzedChunkParams {
  limit: number;
  offset: number;
}

/**
 * 미분석 공시(llm_analyzed_at IS NULL) 청크 스캔 — 공시일 오름차순 + created_at tie-break(결정성, spec 4-5).
 * 부분 인덱스 idx_disclosures_unanalyzed 활용. `securities!inner` 조인으로 표시명·티커·시장을 확보한다.
 */
export async function listUnanalyzedChunk(
  client: SupabaseClient,
  params: ListUnanalyzedChunkParams,
): Promise<RepoResult<UnanalyzedDisclosure[]>> {
  const { limit, offset } = params;
  const { data, error } = await client
    .from("disclosures")
    .select("id, security_id, source, external_id, title, disclosure_date, url, securities!inner(name, ticker, market)")
    .is("llm_analyzed_at", null)
    .order("disclosure_date", { ascending: true })
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error || !data) {
    return repoFail(`listUnanalyzedChunk failed: ${error?.message ?? "no data returned"}`);
  }

  return repoOk(
    (data as unknown as UnanalyzedDisclosureRow[]).map((row) => {
      const security = extractSecurityJoin(row.securities);
      return {
        id: row.id,
        securityId: row.security_id,
        source: row.source,
        externalId: row.external_id,
        title: row.title,
        disclosureDate: row.disclosure_date,
        url: row.url,
        securityName: security?.name ?? "",
        securityTicker: security?.ticker ?? "",
        securityMarket: security?.market ?? "",
      };
    }),
  );
}

/** 분석 완료 마킹(무관 공시·제안 0건 공시 공용) — DB_UPSERT_CHUNK_SIZE 청크 반복. */
export async function markAnalyzed(
  client: SupabaseClient,
  disclosureIds: string[],
  analyzedAtIso: string,
): Promise<RepoResult<void>> {
  if (disclosureIds.length === 0) return repoOk(undefined);

  for (const c of chunk(disclosureIds, DB_UPSERT_CHUNK_SIZE)) {
    const { error } = await client
      .from("disclosures")
      .update({ llm_analyzed_at: analyzedAtIso })
      .in("id", c);
    if (error) {
      return repoFail(`markAnalyzed failed: ${error.message}`);
    }
  }
  return repoOk(undefined);
}
