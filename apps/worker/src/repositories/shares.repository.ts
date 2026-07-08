/**
 * 상장주식수 리포지토리 (docs/usecases/027/plan.md 모듈 12).
 * 소스별 최신 행 조회, 변경분만 UPSERT(onConflict:'security_id,as_of_date,source').
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_UPSERT_CHUNK_SIZE } from "@iib/domain";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface SharesRow {
  securityId: string;
  shares: number;
  asOfDate: string;
  source: "dart" | "sec" | "toss";
  sourceTag: string | null;
  isMultiClassPartial: boolean;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function upsertShares(client: SupabaseClient, rows: SharesRow[]): Promise<RepoResult<void>> {
  if (rows.length === 0) return repoOk(undefined);

  for (const c of chunk(rows, DB_UPSERT_CHUNK_SIZE)) {
    const { error } = await client.from("shares_outstanding").upsert(
      c.map((row) => ({
        security_id: row.securityId,
        shares: row.shares,
        as_of_date: row.asOfDate,
        source: row.source,
        source_tag: row.sourceTag,
        is_multi_class_partial: row.isMultiClassPartial,
      })),
      { onConflict: "security_id,as_of_date,source" },
    );
    if (error) {
      return repoFail(`upsertShares failed: ${error.message}`);
    }
  }
  return repoOk(undefined);
}

export interface LatestShares {
  securityId: string;
  shares: number;
  asOfDate: string;
}

/** 종목별 소스 최신 1건 — DISTINCT ON 대체로 order 후 앱 측에서 최신 행만 축약. */
export async function findLatestBySource(
  client: SupabaseClient,
  securityIds: string[],
  source: "dart" | "sec" | "toss",
): Promise<RepoResult<LatestShares[]>> {
  const { data, error } = await client
    .from("shares_outstanding")
    .select("security_id, shares, as_of_date")
    .in("security_id", securityIds)
    .eq("source", source)
    .order("as_of_date", { ascending: false });

  if (error || !data) {
    return repoFail(`findLatestBySource failed: ${error?.message ?? "no data returned"}`);
  }

  const seen = new Set<string>();
  const latest: LatestShares[] = [];
  for (const row of data as Array<{ security_id: string; shares: number; as_of_date: string }>) {
    if (seen.has(row.security_id)) continue;
    seen.add(row.security_id);
    latest.push({ securityId: row.security_id, shares: row.shares, asOfDate: row.as_of_date });
  }
  return repoOk(latest);
}
