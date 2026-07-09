/**
 * 상장주식수 리포지토리 (docs/usecases/027/plan.md 모듈 12).
 * 소스별 최신 행 조회, 변경분만 UPSERT(onConflict:'security_id,as_of_date,source').
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_UPSERT_CHUNK_SIZE } from "@iib/domain";
import { fetchAllPages, repoFail, repoOk, type RepoResult } from "./result";

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
  // shares_outstanding은 종목당 여러 as_of_date 행이 존재해 종목 수가 적어도 1,000행을 넘기 쉽다.
  // 페이지네이션으로 전량 수집해야 order desc 상 최신 분기 유실을 막는다.
  const paged = await fetchAllPages<{ security_id: string; shares: number; as_of_date: string }>(() =>
    client
      .from("shares_outstanding")
      .select("security_id, shares, as_of_date")
      .in("security_id", securityIds)
      .eq("source", source)
      // security_id를 2차 정렬키로 추가 — 페이지 경계에서 정렬 안정성 확보(동일 as_of_date 다수 시 중복/누락 방지).
      .order("as_of_date", { ascending: false })
      .order("security_id", { ascending: true }),
  );
  if (!paged.ok) {
    return repoFail(`findLatestBySource failed: ${paged.error}`);
  }

  const seen = new Set<string>();
  const latest: LatestShares[] = [];
  for (const row of paged.data) {
    if (seen.has(row.security_id)) continue;
    seen.add(row.security_id);
    latest.push({ securityId: row.security_id, shares: row.shares, asOfDate: row.as_of_date });
  }
  return repoOk(latest);
}
