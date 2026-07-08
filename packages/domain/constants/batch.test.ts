import { describe, expect, it } from "vitest";
import {
  BATCH_CRON_TIMEZONE,
  BATCH_JOB_TYPES,
  BATCH_MAX_RETRY,
  BATCH_RUN_STATUSES,
  BATCH_STALE_RUNNING_HOURS,
  BATCH_TIMEZONE,
  COLLECT_FINANCIALS_CRON,
  COLLECT_FX_MARKET_HOURS_CRON,
  COLLECT_QUOTES_CRON,
  DART_MULTI_ACNT_CHUNK_SIZE,
  DB_UPSERT_CHUNK_SIZE,
  DISCLOSURE_LOOKBACK_DAYS,
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
});
