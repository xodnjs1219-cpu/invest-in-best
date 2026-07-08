/**
 * 스냅샷 리포지토리 (docs/usecases/029/plan.md 모듈 6).
 * 체인별 스냅샷 목록 + 스냅샷별 노드(전체 m + 상장기업 security_id/통화) SELECT.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { repoFail, repoOk, type RepoResult } from "./result";

const SNAPSHOT_NODES_PAGE_SIZE = 1000;

export interface ChainSnapshot {
  id: string;
  effectiveAt: string;
}

/** 체인당 1회 로드 후 domain이 일자·분기별 재사용(idx(chain_id, effective_at DESC) 활용). */
export async function findSnapshotsByChain(
  client: SupabaseClient,
  chainId: string,
  untilIso: string,
): Promise<RepoResult<ChainSnapshot[]>> {
  const { data, error } = await client
    .from("chain_snapshots")
    .select("id, effective_at")
    .eq("chain_id", chainId)
    .lte("effective_at", untilIso)
    .order("effective_at", { ascending: true });

  if (error || !data) {
    return repoFail(`findSnapshotsByChain failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk(
    (data as Array<{ id: string; effective_at: string }>).map((row) => ({
      id: row.id,
      effectiveAt: row.effective_at,
    })),
  );
}

export interface ListedNode {
  securityId: string;
  currency: "KRW" | "USD";
}

export interface SnapshotNodesSummary {
  totalNodeCount: number;
  listedNodes: ListedNode[];
}

interface SnapshotNodeRow {
  snapshot_id: string;
  node_kind: "listed_company" | "free_subject";
  security_id: string | null;
  securities: { currency: "KRW" | "USD" } | { currency: "KRW" | "USD" }[] | null;
}

function extractCurrency(securities: SnapshotNodeRow["securities"]): "KRW" | "USD" | null {
  if (securities === null) return null;
  if (Array.isArray(securities)) return securities[0]?.currency ?? null;
  return securities.currency;
}

/**
 * 스냅샷별 전체 노드 수(m, 자유 주체 포함)와 상장기업 노드(security_id·통화) 목록을 분리 집계한다.
 * `.range()` 페이지네이션으로 전량 수집(스냅샷 다건 × 노드 최대 100 — PostgREST 행 상한 방어, E13).
 */
export async function findNodesBySnapshotIds(
  client: SupabaseClient,
  snapshotIds: string[],
): Promise<RepoResult<Map<string, SnapshotNodesSummary>>> {
  if (snapshotIds.length === 0) return repoOk(new Map());

  const rows: SnapshotNodeRow[] = [];
  let page = 0;
  for (;;) {
    const from = page * SNAPSHOT_NODES_PAGE_SIZE;
    const to = from + SNAPSHOT_NODES_PAGE_SIZE - 1;
    const { data, error } = await client
      .from("snapshot_nodes")
      .select("snapshot_id, node_kind, security_id, securities(currency)")
      .in("snapshot_id", snapshotIds)
      .range(from, to);

    if (error || !data) {
      return repoFail(`findNodesBySnapshotIds failed: ${error?.message ?? "no data returned"}`);
    }
    rows.push(...(data as unknown as SnapshotNodeRow[]));
    if (data.length < SNAPSHOT_NODES_PAGE_SIZE) break;
    page += 1;
  }

  const summaries = new Map<string, SnapshotNodesSummary>();
  for (const row of rows) {
    const summary = summaries.get(row.snapshot_id) ?? { totalNodeCount: 0, listedNodes: [] };
    summary.totalNodeCount += 1;
    if (row.node_kind === "listed_company" && row.security_id !== null) {
      const currency = extractCurrency(row.securities);
      if (currency !== null) {
        summary.listedNodes.push({ securityId: row.security_id, currency });
      }
    }
    summaries.set(row.snapshot_id, summary);
  }
  return repoOk(summaries);
}
