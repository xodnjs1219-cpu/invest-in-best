/**
 * 체인 리포지토리 (docs/usecases/029/plan.md 모듈 6, docs/usecases/030/plan.md 모듈 10 확장).
 * `value_chains` 집계 대상(`is_archived=false`) SELECT — 공식+사용자 전체(BR 6.3, E14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { repoFail, repoOk, type RepoResult } from "./result";

export interface ActiveChain {
  id: string;
}

export async function findActiveChains(client: SupabaseClient): Promise<RepoResult<ActiveChain[]>> {
  const { data, error } = await client.from("value_chains").select("id").eq("is_archived", false);

  if (error || !data) {
    return repoFail(`findActiveChains failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk((data as Array<{ id: string }>).map((row) => ({ id: row.id })));
}

/* ── UC-030(analyze-disclosures) 확장 (docs/usecases/030/plan.md 모듈 10) ── */

export interface ActiveOfficialChain {
  id: string;
  name: string;
}

/** 분석 대상 공식 체인 목록(BR-1) — 사용자 체인·보관 체인은 원천 배제(E6·E9). */
export async function listActiveOfficialChains(
  client: SupabaseClient,
): Promise<RepoResult<ActiveOfficialChain[]>> {
  const { data, error } = await client
    .from("value_chains")
    .select("id, name")
    .eq("chain_type", "official")
    .eq("is_archived", false);

  if (error || !data) {
    return repoFail(`listActiveOfficialChains failed: ${error?.message ?? "no data returned"}`);
  }
  return repoOk((data as Array<{ id: string; name: string }>).map((row) => ({ id: row.id, name: row.name })));
}

export type SnapshotCompositionNodeKind = "listed_company" | "free_subject";

export interface SnapshotCompositionNode {
  nodeId: string;
  displayName: string;
  nodeKind: SnapshotCompositionNodeKind;
  /** 상장기업 노드의 공시 기업 매칭 키(spec 4-4·6.5) — 자유 주체는 null. */
  securityId: string | null;
}

export interface SnapshotCompositionEdge {
  sourceNodeId: string;
  targetNodeId: string;
  relationTypeId: string;
}

export interface SnapshotComposition {
  snapshotId: string;
  nodes: SnapshotCompositionNode[];
  edges: SnapshotCompositionEdge[];
}

interface SnapshotNodeCompositionRow {
  id: string;
  node_kind: SnapshotCompositionNodeKind;
  security_id: string | null;
  subject_name: string | null;
  subject_type: string | null;
  securities: { name: string; ticker: string } | { name: string; ticker: string }[] | null;
}

function extractSecurityName(
  securities: SnapshotNodeCompositionRow["securities"],
): string | null {
  if (securities === null) return null;
  if (Array.isArray(securities)) return securities[0]?.name ?? null;
  return securities.name;
}

function toDisplayName(row: SnapshotNodeCompositionRow): string {
  if (row.node_kind === "listed_company") {
    return extractSecurityName(row.securities) ?? row.subject_name ?? row.id;
  }
  return row.subject_name ?? row.id;
}

/**
 * 체인의 최신 스냅샷(effective_at DESC, created_at DESC tie-break) 구성(노드·엣지)을 로드한다(spec 4-3).
 * 스냅샷이 0건이면 `{ ok: true, data: null }`(E9 입력 — 잡이 해당 체인을 분석 대상에서 제외).
 */
export async function findLatestSnapshotComposition(
  client: SupabaseClient,
  chainId: string,
): Promise<RepoResult<SnapshotComposition | null>> {
  const { data: snapshot, error: snapshotError } = await client
    .from("chain_snapshots")
    .select("id, effective_at")
    .eq("chain_id", chainId)
    .order("effective_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; effective_at: string }>();

  if (snapshotError) {
    return repoFail(`findLatestSnapshotComposition(snapshot) failed: ${snapshotError.message}`);
  }
  if (!snapshot) {
    return repoOk(null);
  }

  const { data: nodeRows, error: nodesError } = await client
    .from("snapshot_nodes")
    .select("id, node_kind, security_id, subject_name, subject_type, securities(name, ticker)")
    .eq("snapshot_id", snapshot.id);

  if (nodesError || !nodeRows) {
    return repoFail(`findLatestSnapshotComposition(nodes) failed: ${nodesError?.message ?? "no data returned"}`);
  }

  const { data: edgeRows, error: edgesError } = await client
    .from("snapshot_edges")
    .select("id, source_node_id, target_node_id, relation_type_id")
    .eq("snapshot_id", snapshot.id);

  if (edgesError || !edgeRows) {
    return repoFail(`findLatestSnapshotComposition(edges) failed: ${edgesError?.message ?? "no data returned"}`);
  }

  const nodes: SnapshotCompositionNode[] = (nodeRows as unknown as SnapshotNodeCompositionRow[]).map((row) => ({
    nodeId: row.id,
    displayName: toDisplayName(row),
    nodeKind: row.node_kind,
    securityId: row.security_id,
  }));

  const edges: SnapshotCompositionEdge[] = (
    edgeRows as Array<{ id: string; source_node_id: string; target_node_id: string; relation_type_id: string }>
  ).map((row) => ({
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    relationTypeId: row.relation_type_id,
  }));

  return repoOk({ snapshotId: snapshot.id, nodes, edges });
}
