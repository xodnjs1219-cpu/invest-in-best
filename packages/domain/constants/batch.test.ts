import { describe, expect, it } from "vitest";
import {
  BATCH_MAX_RETRY,
  COLLECT_QUOTES_CRON,
  DB_UPSERT_CHUNK_SIZE,
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
});
