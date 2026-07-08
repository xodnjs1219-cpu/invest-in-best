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

// ============================================
// 체인 카드 목록 (UC-007, plan 모듈 C-3)
// ============================================

const LIST_CHAIN_CARDS_RPC = "list_chain_cards";

export type FindChainCardsParams = {
  chainType: "official" | "user";
  ownerId: string | null;
  limit: number;
  offset: number;
};

export type FindChainCardsResult = {
  rows: unknown[];
  error: string | null;
};

/**
 * `list_chain_cards` RPC(0016 마이그레이션) 호출 캡슐화 — Supabase 오류는 예외를 던지지 않고
 * `{ rows: [], error: message }`로 반환한다(Result 지향, securities 패턴과 동일).
 * Row 해석/검증은 하지 않는다(그대로 service에 전달 — Persistence는 접근만 담당).
 */
export const findChainCards = async (
  client: SupabaseClient,
  params: FindChainCardsParams,
): Promise<FindChainCardsResult> => {
  const { data, error } = await client.rpc(LIST_CHAIN_CARDS_RPC, {
    p_chain_type: params.chainType,
    p_owner_id: params.ownerId,
    p_limit: params.limit,
    p_offset: params.offset,
  });

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: data ?? [], error: null };
};

// ============================================================================
// UC-010: 밸류체인 대시보드 지표(일별/분기) 리포지토리
// ============================================================================

const CHAIN_DAILY_METRICS_TABLE = "chain_daily_metrics";
const CHAIN_QUARTERLY_METRICS_TABLE = "chain_quarterly_metrics";
const FN_CHAIN_DAILY_ANNOTATIONS = "fn_chain_daily_annotations";

export type RepoResult<T> = { ok: true; data: T } | { ok: false; message: string };

/** 서비스는 이 인터페이스에만 의존한다(UC-010 지표 조회 전용). */
export interface ChainMetricsRepository {
  findDailySeries(chainId: string, from: string, to: string): Promise<RepoResult<unknown[]>>;
  findLatestDaily(chainId: string): Promise<RepoResult<unknown | null>>;
  findDailyByDate(chainId: string, date: string): Promise<RepoResult<unknown | null>>;
  findQuarterlySeries(chainId: string, fromYear: number, toYear: number): Promise<RepoResult<unknown[]>>;
  findLatestQuarterly(chainId: string): Promise<RepoResult<unknown | null>>;
  findQuarterlyByQuarter(
    chainId: string,
    year: number,
    quarter: number,
  ): Promise<RepoResult<unknown | null>>;
  fetchDailyAnnotations(
    chainId: string,
    asOfIso: string,
    metricDate: string | null,
  ): Promise<RepoResult<unknown>>;
}

export const createChainMetricsRepository = (client: SupabaseClient): ChainMetricsRepository => ({
  async findDailySeries(chainId, from, to) {
    const { data, error } = await client
      .from(CHAIN_DAILY_METRICS_TABLE)
      .select("metric_date, total_market_cap_krw, covered_node_count, total_node_count, is_carried_forward, based_on_snapshot_id")
      .eq("chain_id", chainId)
      .gte("metric_date", from)
      .lte("metric_date", to)
      .order("metric_date", { ascending: true });

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? [] };
  },

  async findLatestDaily(chainId) {
    const { data, error } = await client
      .from(CHAIN_DAILY_METRICS_TABLE)
      .select("metric_date, total_market_cap_krw, covered_node_count, total_node_count, is_carried_forward, based_on_snapshot_id")
      .eq("chain_id", chainId)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? null };
  },

  async findDailyByDate(chainId, date) {
    const { data, error } = await client
      .from(CHAIN_DAILY_METRICS_TABLE)
      .select("metric_date, total_market_cap_krw, covered_node_count, total_node_count, is_carried_forward, based_on_snapshot_id")
      .eq("chain_id", chainId)
      .eq("metric_date", date)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? null };
  },

  async findQuarterlySeries(chainId, fromYear, toYear) {
    const { data, error } = await client
      .from(CHAIN_QUARTERLY_METRICS_TABLE)
      .select(
        "calendar_year, calendar_quarter, total_revenue_krw, covered_node_count, total_node_count, excluded_unmapped_count, based_on_snapshot_id",
      )
      .eq("chain_id", chainId)
      .gte("calendar_year", fromYear)
      .lte("calendar_year", toYear)
      .order("calendar_year", { ascending: true })
      .order("calendar_quarter", { ascending: true });

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? [] };
  },

  async findLatestQuarterly(chainId) {
    const { data, error } = await client
      .from(CHAIN_QUARTERLY_METRICS_TABLE)
      .select(
        "calendar_year, calendar_quarter, total_revenue_krw, covered_node_count, total_node_count, excluded_unmapped_count, based_on_snapshot_id",
      )
      .eq("chain_id", chainId)
      .order("calendar_year", { ascending: false })
      .order("calendar_quarter", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? null };
  },

  async findQuarterlyByQuarter(chainId, year, quarter) {
    const { data, error } = await client
      .from(CHAIN_QUARTERLY_METRICS_TABLE)
      .select(
        "calendar_year, calendar_quarter, total_revenue_krw, covered_node_count, total_node_count, excluded_unmapped_count, based_on_snapshot_id",
      )
      .eq("chain_id", chainId)
      .eq("calendar_year", year)
      .eq("calendar_quarter", quarter)
      .maybeSingle();

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, data: data ?? null };
  },

  async fetchDailyAnnotations(chainId, asOfIso, metricDate) {
    const { data, error } = await client.rpc(FN_CHAIN_DAILY_ANNOTATIONS, {
      p_chain_id: chainId,
      p_as_of: asOfIso,
      p_metric_date: metricDate,
    });

    if (error) {
      return { ok: false, message: error.message };
    }
    // Postgres `RETURNS TABLE`은 배열로 반환된다 — 단일 행만 존재.
    const row = Array.isArray(data) ? (data[0] ?? null) : data;
    return { ok: true, data: row };
  },
});

// ============================================================================
// UC-011: 노드 상세 조회 리포지토리
// ============================================================================

const NODE_DETAIL_SELECT =
  "id, snapshot_id, node_kind, group_id, subject_name, subject_type, subject_memo, " +
  "chain_snapshots!inner(chain_id), " +
  "snapshot_groups(id, name), " +
  "securities(id, ticker, market, name, listing_status)";

/**
 * 노드 상세 조회 — `chain_snapshots!inner` + `eq('chain_snapshots.chain_id', ...)`로
 * 노드의 체인 소속을 DB 조회 단계에서 검증한다(E7: 타 체인 노드 → 0행 → null).
 */
export const findNodeDetailRow = async (
  client: SupabaseClient,
  chainId: string,
  nodeId: string,
): Promise<{ row: unknown | null } | { dbError: string }> => {
  const { data, error } = await client
    .from(SNAPSHOT_NODES_TABLE)
    .select(NODE_DETAIL_SELECT)
    .eq("id", nodeId)
    .eq("chain_snapshots.chain_id", chainId)
    .maybeSingle();

  if (error) {
    return { dbError: error.message };
  }
  return { row: data ?? null };
};

// ============================================================================
// UC-012: 타임라인 조회/스냅샷 복원 리포지토리
// ============================================================================

const FN_CHAIN_SNAPSHOT_AT = "fn_chain_snapshot_at";

/** 체인의 모든 구조 변경 이벤트 시각(마커) — `effective_at` 오름차순 전체. */
export const findSnapshotMarkers = async (
  client: SupabaseClient,
  chainId: string,
): Promise<RepoResult<unknown[]>> => {
  const { data, error } = await client
    .from(CHAIN_SNAPSHOTS_TABLE)
    .select("id, effective_at, change_source")
    .eq("chain_id", chainId)
    .order("effective_at", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, data: data ?? [] };
};

/** `fn_chain_snapshot_at` RPC 호출 — 스냅샷 없으면 `data: null`(SNAPSHOT_NOT_FOUND로 매핑은 service 책임). */
export const findSnapshotStructureAt = async (
  client: SupabaseClient,
  chainId: string,
  asOfIso: string,
): Promise<RepoResult<unknown | null>> => {
  const { data, error } = await client.rpc(FN_CHAIN_SNAPSHOT_AT, {
    p_chain_id: chainId,
    p_as_of: asOfIso,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, data: data ?? null };
};

// ============================================================================
// UC-016: findLatestEdgeIdentities (BR-4 대조용 — 저장 service(UC-018/021)가 소비)
// ============================================================================

/** 순수 데이터 형태 — service/domain 계층(`NodeIdentity`/`PreviousEdgeIdentity`)과 구조적으로 호환. */
export type LatestEdgeIdentityRow = {
  relationTypeId: string;
  source: { kind: "listed_company"; securityId: string } | { kind: "free_subject"; subjectName: string; subjectType: string };
  target: { kind: "listed_company"; securityId: string } | { kind: "free_subject"; subjectName: string; subjectType: string };
};

type SnapshotNodeIdentityRow = {
  node_kind: "listed_company" | "free_subject";
  security_id: string | null;
  subject_name: string | null;
  subject_type: string | null;
};

function toNodeIdentity(row: SnapshotNodeIdentityRow): LatestEdgeIdentityRow["source"] {
  if (row.node_kind === "listed_company") {
    return { kind: "listed_company", securityId: row.security_id as string };
  }
  return { kind: "free_subject", subjectName: row.subject_name as string, subjectType: row.subject_type as string };
}

/**
 * 최신 스냅샷의 엣지를 노드 정체성(BR-4·D-7)으로 매핑해 반환 — 저장 시 비활성 관계 종류의
 * "기존 엣지 유지" 판별(공식 체인 저장, UC-021)에 사용된다. 최신 스냅샷 없으면 `null`(신규 저장 신호).
 */
export const findLatestEdgeIdentities = async (
  client: SupabaseClient,
  chainId: string,
): Promise<LatestEdgeIdentityRow[] | null> => {
  const { data: snapshot, error: snapshotError } = await client
    .from(CHAIN_SNAPSHOTS_TABLE)
    .select("id")
    .eq("chain_id", chainId)
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError || !snapshot) {
    return null;
  }

  const { data, error } = await client
    .from(SNAPSHOT_EDGES_TABLE)
    .select(
      "relation_type_id, " +
        "source_node:snapshot_nodes!snapshot_edges_source_node_id_fkey(node_kind, security_id, subject_name, subject_type), " +
        "target_node:snapshot_nodes!snapshot_edges_target_node_id_fkey(node_kind, security_id, subject_name, subject_type)",
    )
    .eq("snapshot_id", (snapshot as { id: string }).id);

  if (error || !data) {
    return null;
  }

  return (
    data as unknown as Array<{
      relation_type_id: string;
      source_node: SnapshotNodeIdentityRow;
      target_node: SnapshotNodeIdentityRow;
    }>
  ).map((row) => ({
    relationTypeId: row.relation_type_id,
    source: toNodeIdentity(row.source_node),
    target: toNodeIdentity(row.target_node),
  }));
};

/** 해당 일자 이하 최신 일별 지표 1건(이월 규칙, database §4.5 패턴). */
export const findDailyMetricAt = async (
  client: SupabaseClient,
  chainId: string,
  date: string,
): Promise<RepoResult<unknown | null>> => {
  const { data, error } = await client
    .from(CHAIN_DAILY_METRICS_TABLE)
    .select("metric_date, total_market_cap_krw, covered_node_count, total_node_count, is_carried_forward, based_on_snapshot_id")
    .eq("chain_id", chainId)
    .lte("metric_date", date)
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, data: data ?? null };
};

/** D가 속한 역년 분기의 매출 지표 단건. */
export const findQuarterlyMetric = async (
  client: SupabaseClient,
  chainId: string,
  year: number,
  quarter: number,
): Promise<RepoResult<unknown | null>> => {
  const { data, error } = await client
    .from(CHAIN_QUARTERLY_METRICS_TABLE)
    .select(
      "calendar_year, calendar_quarter, total_revenue_krw, covered_node_count, total_node_count, excluded_unmapped_count, based_on_snapshot_id",
    )
    .eq("chain_id", chainId)
    .eq("calendar_year", year)
    .eq("calendar_quarter", quarter)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, data: data ?? null };
};
