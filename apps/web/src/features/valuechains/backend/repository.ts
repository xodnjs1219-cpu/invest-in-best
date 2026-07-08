import type { SupabaseClient } from "@supabase/supabase-js";
import type { FreshnessJobType } from "@iib/domain";

/**
 * valuechains 뷰 조회 리포지토리 (plan 모듈 B3).
 * Supabase 쿼리를 캡슐화한다 — 반환은 `unknown`(원시 행), Row 스키마 검증은 서비스 책임(계층 분리).
 * "행 없음"은 `null` 반환, Supabase 오류는 `RepositoryError` throw로 구분한다.
 */

const VALUE_CHAINS_TABLE = "value_chains";
const CHAIN_SNAPSHOTS_TABLE = "chain_snapshots";
const SNAPSHOT_GROUPS_TABLE = "snapshot_groups";
const SNAPSHOT_NODES_TABLE = "snapshot_nodes";
const SNAPSHOT_EDGES_TABLE = "snapshot_edges";
const BATCH_RUNS_TABLE = "batch_runs";

const CHAIN_SELECT =
  "id, chain_type, owner_id, name, focus_type, focus_security_id, is_archived, source_chain_id, " +
  "focus_security:securities!value_chains_focus_security_id_fkey(id, ticker, name, market)";

const SNAPSHOT_SELECT = "id, chain_id, effective_at, change_source";

const GROUP_SELECT = "id, name";

const NODE_SELECT =
  "id, group_id, node_kind, security_id, subject_name, subject_type, subject_memo, position_x, position_y, " +
  "security:securities(id, ticker, name, market, listing_status)";

const EDGE_SELECT =
  "id, source_node_id, target_node_id, " +
  "relation_type:relation_types(id, name, is_directed, is_active)";

const SUCCESS_STATUSES = ["success", "partial_success"] as const;

/** Supabase 쿼리 실패(예외 아님, 응답 error 필드)를 나타내는 리포지토리 계층 오류. */
export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}

/** 서비스는 이 인터페이스에만 의존한다(구현은 Supabase 쿼리 문법을 안다). */
export interface ValuechainsViewRepository {
  findChainById(chainId: string): Promise<unknown | null>;
  findLatestSnapshot(chainId: string): Promise<unknown | null>;
  findSnapshotGroups(snapshotId: string): Promise<unknown[]>;
  findSnapshotNodes(snapshotId: string): Promise<unknown[]>;
  findSnapshotEdges(snapshotId: string): Promise<unknown[]>;
  findLatestBatchSuccessAt(jobType: FreshnessJobType): Promise<string | null>;
}

export const createValuechainsViewRepository = (
  client: SupabaseClient,
): ValuechainsViewRepository => ({
  async findChainById(chainId) {
    const { data, error } = await client
      .from(VALUE_CHAINS_TABLE)
      .select(CHAIN_SELECT)
      .eq("id", chainId)
      .maybeSingle();

    if (error) {
      throw new RepositoryError(error.message);
    }
    return data ?? null;
  },

  async findLatestSnapshot(chainId) {
    const { data, error } = await client
      .from(CHAIN_SNAPSHOTS_TABLE)
      .select(SNAPSHOT_SELECT)
      .eq("chain_id", chainId)
      .order("effective_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new RepositoryError(error.message);
    }
    return data ?? null;
  },

  async findSnapshotGroups(snapshotId) {
    const { data, error } = await client
      .from(SNAPSHOT_GROUPS_TABLE)
      .select(GROUP_SELECT)
      .eq("snapshot_id", snapshotId);

    if (error) {
      throw new RepositoryError(error.message);
    }
    return data ?? [];
  },

  async findSnapshotNodes(snapshotId) {
    const { data, error } = await client
      .from(SNAPSHOT_NODES_TABLE)
      .select(NODE_SELECT)
      .eq("snapshot_id", snapshotId);

    if (error) {
      throw new RepositoryError(error.message);
    }
    return data ?? [];
  },

  async findSnapshotEdges(snapshotId) {
    // E5: 비활성(is_active=false) 관계 종류의 기존 엣지도 그대로 반환한다 — 필터 없음.
    const { data, error } = await client
      .from(SNAPSHOT_EDGES_TABLE)
      .select(EDGE_SELECT)
      .eq("snapshot_id", snapshotId);

    if (error) {
      throw new RepositoryError(error.message);
    }
    return data ?? [];
  },

  async findLatestBatchSuccessAt(jobType) {
    const { data, error } = await client
      .from(BATCH_RUNS_TABLE)
      .select("finished_at")
      .eq("job_type", jobType)
      .in("status", [...SUCCESS_STATUSES])
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new RepositoryError(error.message);
    }
    const row = data as { finished_at: string | null } | null;
    return row?.finished_at ?? null;
  },
});
