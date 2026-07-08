/**
 * 공시 리포지토리 (docs/usecases/027/plan.md 모듈 12).
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
