import { describe, expect, it } from "vitest";
import {
  ADMIN_BATCH_FAILURES_PAGE_SIZE_DEFAULT,
  ADMIN_BATCH_FAILURES_PAGE_SIZE_MAX,
  ADMIN_BATCH_RUNS_PAGE_SIZE_DEFAULT,
  ADMIN_BATCH_RUNS_PAGE_SIZE_MAX,
  BATCH_RUNS_DEFAULT_LOOKBACK_DAYS,
  BATCH_RUNS_POLL_INTERVAL_MS,
} from "./batchMonitoring";

describe("batchMonitoring constants", () => {
  it("run list page size defaults are >=1 integers within the max bound (BR-7)", () => {
    expect(Number.isInteger(ADMIN_BATCH_RUNS_PAGE_SIZE_DEFAULT)).toBe(true);
    expect(ADMIN_BATCH_RUNS_PAGE_SIZE_DEFAULT).toBeGreaterThanOrEqual(1);
    expect(ADMIN_BATCH_RUNS_PAGE_SIZE_DEFAULT).toBeLessThanOrEqual(ADMIN_BATCH_RUNS_PAGE_SIZE_MAX);
  });

  it("failures page size defaults are >=1 integers within the max bound (BR-7)", () => {
    expect(Number.isInteger(ADMIN_BATCH_FAILURES_PAGE_SIZE_DEFAULT)).toBe(true);
    expect(ADMIN_BATCH_FAILURES_PAGE_SIZE_DEFAULT).toBeGreaterThanOrEqual(1);
    expect(ADMIN_BATCH_FAILURES_PAGE_SIZE_DEFAULT).toBeLessThanOrEqual(
      ADMIN_BATCH_FAILURES_PAGE_SIZE_MAX,
    );
  });

  it("BATCH_RUNS_DEFAULT_LOOKBACK_DAYS is a positive integer (R-4)", () => {
    expect(Number.isInteger(BATCH_RUNS_DEFAULT_LOOKBACK_DAYS)).toBe(true);
    expect(BATCH_RUNS_DEFAULT_LOOKBACK_DAYS).toBeGreaterThan(0);
  });

  it("BATCH_RUNS_POLL_INTERVAL_MS is at least 1000ms to prevent excessive polling (R-6)", () => {
    expect(BATCH_RUNS_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(1_000);
  });
});
