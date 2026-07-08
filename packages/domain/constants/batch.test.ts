import { describe, expect, it } from "vitest";
import {
  AGGREGATE_DAILY_METRICS_CRON,
  AGGREGATION_DATE_WINDOW_DAYS,
  BACKFILL_CANDLE_PAGE_COUNT,
  BACKFILL_CONFLICT_JOB_TYPES,
  BACKFILL_HEARTBEAT_STALE_MS,
  BACKFILL_JOB_TYPE,
  BACKFILL_KRX_DISCLOSURE_MONTHS,
  BACKFILL_PROGRESS_UPDATE_EVERY_N_UNITS,
  BACKFILL_REGULAR_JOB_POLL_MS,
  BATCH_CRON_TIMEZONE,
  BATCH_JOB_TYPES,
  BATCH_JOB_TYPE_AGGREGATE_DAILY_METRICS,
  BATCH_MAX_RETRY,
  BATCH_RUNNING_STALE_HOURS,
  BATCH_RUN_STATUSES,
  BATCH_STALE_RUNNING_HOURS,
  BATCH_TIMEZONE,
  COLLECT_FINANCIALS_CRON,
  COLLECT_FX_MARKET_HOURS_CRON,
  COLLECT_QUOTES_CRON,
  DART_MULTI_ACNT_CHUNK_SIZE,
  DB_UPSERT_CHUNK_SIZE,
  DISCLOSURE_LOOKBACK_DAYS,
  OPENDART_BACKFILL_DAILY_CALL_BUDGET,
  QUOTE_TICKS_RETENTION_DAYS,
  TOSS_SYMBOLS_CHUNK_SIZE,
} from "./batch";

describe("batch constants", () => {
  it("TOSS_SYMBOLS_CHUNK_SIZE stays within the external contract limit (1~200)", () => {
    expect(TOSS_SYMBOLS_CHUNK_SIZE).toBeGreaterThanOrEqual(1);
    expect(TOSS_SYMBOLS_CHUNK_SIZE).toBeLessThanOrEqual(200);
  });

  it("core batch policy constants match the spec", () => {
    expect(COLLECT_QUOTES_CRON).toBe("0 * * * *");
    expect(QUOTE_TICKS_RETENTION_DAYS).toBe(30);
    expect(BATCH_MAX_RETRY).toBe(3);
    expect(DB_UPSERT_CHUNK_SIZE).toBeGreaterThan(0);
  });

  it("COLLECT_FINANCIALS_CRON runs once daily after market close (19:00 KST)", () => {
    expect(COLLECT_FINANCIALS_CRON).toBe("0 19 * * *");
    expect(BATCH_TIMEZONE).toBe("Asia/Seoul");
  });

  it("DART_MULTI_ACNT_CHUNK_SIZE respects the external 100-company cap (status 021 guard)", () => {
    expect(DART_MULTI_ACNT_CHUNK_SIZE).toBeLessThanOrEqual(100);
  });

  it("BATCH_STALE_RUNNING_HOURS and DISCLOSURE_LOOKBACK_DAYS are positive", () => {
    expect(BATCH_STALE_RUNNING_HOURS).toBeGreaterThan(0);
    expect(DISCLOSURE_LOOKBACK_DAYS).toBeGreaterThan(0);
  });

  it("COLLECT_FX_MARKET_HOURS_CRON runs before COLLECT_QUOTES' first 09:00 KST open-market check", () => {
    expect(COLLECT_FX_MARKET_HOURS_CRON).toBe("30 8 * * *");
    expect(BATCH_CRON_TIMEZONE).toBe("Asia/Seoul");
    const hourField = Number(COLLECT_FX_MARKET_HOURS_CRON.split(" ")[1]);
    expect(hourField).toBeLessThan(9);
  });

  it("BATCH_JOB_TYPES matches docs/database.md §5 batch_job_type enum (6 kinds, order-sensitive)", () => {
    expect(BATCH_JOB_TYPES).toEqual([
      "collect_quotes",
      "collect_financials",
      "collect_fx_market_hours",
      "aggregate_daily_metrics",
      "analyze_disclosures",
      "backfill_all",
    ]);
  });

  it("BATCH_RUN_STATUSES matches docs/database.md §5 batch_run_status enum (4 kinds)", () => {
    expect(BATCH_RUN_STATUSES).toEqual(["running", "success", "partial_success", "failed"]);
  });

  it("AGGREGATE_DAILY_METRICS_CRON is a well-formed 5-field cron expression", () => {
    const fields = AGGREGATE_DAILY_METRICS_CRON.split(" ");
    expect(fields).toHaveLength(5);
    expect(fields.every((f) => /^(\*|[\d,/*-]+)$/.test(f))).toBe(true);
  });

  it("AGGREGATE_DAILY_METRICS_CRON runs after collect_quotes/financials/fx (026~028) same-day jobs", () => {
    expect(BATCH_JOB_TYPE_AGGREGATE_DAILY_METRICS).toBe("aggregate_daily_metrics");
    const hourField = Number(AGGREGATE_DAILY_METRICS_CRON.split(" ")[1]);
    expect(hourField).toBeGreaterThanOrEqual(8);
  });

  it("BATCH_RUNNING_STALE_HOURS and AGGREGATION_DATE_WINDOW_DAYS are positive", () => {
    expect(BATCH_RUNNING_STALE_HOURS).toBeGreaterThan(0);
    expect(AGGREGATION_DATE_WINDOW_DAYS).toBeGreaterThan(0);
  });

  it("BACKFILL_JOB_TYPE matches the batch_job_type enum literal for UC-031", () => {
    expect(BACKFILL_JOB_TYPE).toBe("backfill_all");
    expect(BATCH_JOB_TYPES).toContain(BACKFILL_JOB_TYPE);
  });

  it("BACKFILL_CANDLE_PAGE_COUNT respects the tossinvest candles external cap (<=200)", () => {
    expect(BACKFILL_CANDLE_PAGE_COUNT).toBeGreaterThan(0);
    expect(BACKFILL_CANDLE_PAGE_COUNT).toBeLessThanOrEqual(200);
  });

  it("OPENDART_BACKFILL_DAILY_CALL_BUDGET reserves headroom under the 20,000/day hard limit (H-7)", () => {
    expect(OPENDART_BACKFILL_DAILY_CALL_BUDGET).toBeGreaterThan(0);
    expect(OPENDART_BACKFILL_DAILY_CALL_BUDGET).toBeLessThan(20_000);
  });

  it("BACKFILL_REGULAR_JOB_POLL_MS and BACKFILL_HEARTBEAT_STALE_MS are positive, poll << stale (H-7/E17)", () => {
    expect(BACKFILL_REGULAR_JOB_POLL_MS).toBeGreaterThan(0);
    expect(BACKFILL_HEARTBEAT_STALE_MS).toBeGreaterThan(0);
    expect(BACKFILL_REGULAR_JOB_POLL_MS).toBeLessThan(BACKFILL_HEARTBEAT_STALE_MS);
  });

  it("BACKFILL_CONFLICT_JOB_TYPES lists the regular (non-backfill) jobs it must yield to (H-7)", () => {
    expect(BACKFILL_CONFLICT_JOB_TYPES).not.toContain(BACKFILL_JOB_TYPE);
    for (const jobType of BACKFILL_CONFLICT_JOB_TYPES) {
      expect(BATCH_JOB_TYPES).toContain(jobType);
    }
  });

  it("BACKFILL_KRX_DISCLOSURE_MONTHS and BACKFILL_PROGRESS_UPDATE_EVERY_N_UNITS are positive (H-10)", () => {
    expect(BACKFILL_KRX_DISCLOSURE_MONTHS).toBeGreaterThan(0);
    expect(BACKFILL_PROGRESS_UPDATE_EVERY_N_UNITS).toBeGreaterThan(0);
  });
});
