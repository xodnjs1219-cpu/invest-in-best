/**
 * 지표 적재 리포지토리 (docs/usecases/029/plan.md 모듈 8).
 * chain_daily_metrics/chain_quarterly_metrics 청크 UPSERT(멱등), 체인 삭제 경합(E15) 판별.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_UPSERT_CHUNK_SIZE } from "@iib/domain";
import { withRetry } from "../runtime/retry";

/** Postgres FK 위반 오류 코드(체인 삭제 경합, E15). */
const POSTGRES_FOREIGN_KEY_VIOLATION = "23503";

export type ChainMetricsUpsertOutcome =
  | { ok: true; data: { count: number } }
  | { ok: false; kind: "chain_deleted"; message: string }
  | { ok: false; kind: "db_error"; message: string };

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface DailyMetricRow {
  chainId: string;
  metricDate: string;
  basedOnSnapshotId: string;
  totalMarketCapKrw: number | null;
  coveredNodeCount: number;
  totalNodeCount: number;
  isCarriedForward: boolean;
}

/** DB_UPSERT_CHUNK_SIZE 청크 반복 upsert — 재실행 멱등(BR 6.2, E11). 1회 재시도(DB 연산 실패만, BR 6.3). */
export async function upsertDailyMetrics(
  client: SupabaseClient,
  rows: DailyMetricRow[],
): Promise<ChainMetricsUpsertOutcome> {
  if (rows.length === 0) return { ok: true, data: { count: 0 } };

  let count = 0;
  for (const c of chunk(rows, DB_UPSERT_CHUNK_SIZE)) {
    try {
      const result = await withRetry(
        async () => {
          const { error } = await client.from("chain_daily_metrics").upsert(
            c.map((row) => ({
              chain_id: row.chainId,
              metric_date: row.metricDate,
              based_on_snapshot_id: row.basedOnSnapshotId,
              total_market_cap_krw: row.totalMarketCapKrw,
              covered_node_count: row.coveredNodeCount,
              total_node_count: row.totalNodeCount,
              is_carried_forward: row.isCarriedForward,
            })),
            { onConflict: "chain_id,metric_date" },
          );
          if (error) throw error;
          return true;
        },
        { retries: 1 },
      );
      if (result) count += c.length;
    } catch (error) {
      const pgError = error as { code?: string; message?: string };
      if (pgError.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
        return { ok: false, kind: "chain_deleted", message: pgError.message ?? "chain deleted during upsert" };
      }
      return { ok: false, kind: "db_error", message: pgError.message ?? String(error) };
    }
  }
  return { ok: true, data: { count } };
}

export interface QuarterlyMetricRow {
  chainId: string;
  calendarYear: number;
  calendarQuarter: number;
  basedOnSnapshotId: string;
  totalRevenueKrw: number | null;
  coveredNodeCount: number;
  totalNodeCount: number;
  excludedUnmappedCount: number;
}

/** onConflict: chain_id,calendar_year,calendar_quarter — 동일 패턴. */
export async function upsertQuarterlyMetrics(
  client: SupabaseClient,
  rows: QuarterlyMetricRow[],
): Promise<ChainMetricsUpsertOutcome> {
  if (rows.length === 0) return { ok: true, data: { count: 0 } };

  let count = 0;
  for (const c of chunk(rows, DB_UPSERT_CHUNK_SIZE)) {
    try {
      const result = await withRetry(
        async () => {
          const { error } = await client.from("chain_quarterly_metrics").upsert(
            c.map((row) => ({
              chain_id: row.chainId,
              calendar_year: row.calendarYear,
              calendar_quarter: row.calendarQuarter,
              based_on_snapshot_id: row.basedOnSnapshotId,
              total_revenue_krw: row.totalRevenueKrw,
              covered_node_count: row.coveredNodeCount,
              total_node_count: row.totalNodeCount,
              excluded_unmapped_count: row.excludedUnmappedCount,
            })),
            { onConflict: "chain_id,calendar_year,calendar_quarter" },
          );
          if (error) throw error;
          return true;
        },
        { retries: 1 },
      );
      if (result) count += c.length;
    } catch (error) {
      const pgError = error as { code?: string; message?: string };
      if (pgError.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
        return { ok: false, kind: "chain_deleted", message: pgError.message ?? "chain deleted during upsert" };
      }
      return { ok: false, kind: "db_error", message: pgError.message ?? String(error) };
    }
  }
  return { ok: true, data: { count } };
}
