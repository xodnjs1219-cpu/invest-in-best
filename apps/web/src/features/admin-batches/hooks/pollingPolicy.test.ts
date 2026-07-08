import { BATCH_RUNS_POLL_INTERVAL_MS } from "@iib/domain";
import { describe, expect, it } from "vitest";
import type { BatchRunsListResponse } from "@/features/admin-batches/backend/schema";
import {
  hasRunningRun,
  resolveBackfillRefetchInterval,
  resolveRunsRefetchInterval,
} from "@/features/admin-batches/hooks/pollingPolicy";

const buildResponse = (
  runs: BatchRunsListResponse["runs"],
): BatchRunsListResponse => ({
  runs,
  pagination: { page: 1, pageSize: 20, totalCount: runs.length },
});

const buildRun = (
  overrides: Partial<BatchRunsListResponse["runs"][number]> = {},
): BatchRunsListResponse["runs"][number] => ({
  id: "run-1",
  jobType: "collect_quotes",
  status: "success",
  startedAt: "2026-07-05T00:00:00.000Z",
  finishedAt: "2026-07-05T00:10:00.000Z",
  processedCount: 100,
  failedCount: 0,
  isCarriedOver: false,
  targetMarket: "KRX",
  hasErrorLog: false,
  ...overrides,
});

describe("hasRunningRun", () => {
  it("running 상태 행이 있으면 true를 반환한다", () => {
    const runs = [buildRun({ status: "running" })];
    expect(hasRunningRun(runs)).toBe(true);
  });

  it("전부 종료 상태면 false를 반환한다", () => {
    const runs = [buildRun({ status: "success" }), buildRun({ status: "failed" })];
    expect(hasRunningRun(runs)).toBe(false);
  });

  it("빈 배열이면 false를 반환한다(E1)", () => {
    expect(hasRunningRun([])).toBe(false);
  });
});

describe("resolveRunsRefetchInterval", () => {
  it("runs에 running 1건 포함 시 BATCH_RUNS_POLL_INTERVAL_MS를 반환한다(E2)", () => {
    const data = buildResponse([buildRun({ status: "running" })]);
    expect(resolveRunsRefetchInterval(data)).toBe(BATCH_RUNS_POLL_INTERVAL_MS);
  });

  it("전부 종료 상태면 false를 반환한다(폴링 중단, Main 7)", () => {
    const data = buildResponse([buildRun({ status: "success" })]);
    expect(resolveRunsRefetchInterval(data)).toBe(false);
  });

  it("data가 undefined(로딩/오류)면 false를 반환한다(E12)", () => {
    expect(resolveRunsRefetchInterval(undefined)).toBe(false);
  });

  it("빈 목록이면 false를 반환한다(E1)", () => {
    expect(resolveRunsRefetchInterval(buildResponse([]))).toBe(false);
  });
});

describe("resolveBackfillRefetchInterval", () => {
  it("latestRun이 null이면 false를 반환한다", () => {
    expect(
      resolveBackfillRefetchInterval({
        totalCheckpoints: 0,
        completedCheckpoints: 0,
        isCompleted: false,
        latestRun: null,
      }),
    ).toBe(false);
  });

  it("latestRun.status가 running이면 폴링 주기를 반환한다", () => {
    expect(
      resolveBackfillRefetchInterval({
        totalCheckpoints: 3200,
        completedCheckpoints: 2710,
        isCompleted: false,
        latestRun: {
          id: "run-1",
          status: "running",
          startedAt: "2026-07-04T09:00:00.000Z",
          finishedAt: null,
        },
      }),
    ).toBe(BATCH_RUNS_POLL_INTERVAL_MS);
  });

  it("data가 undefined면 false를 반환한다", () => {
    expect(resolveBackfillRefetchInterval(undefined)).toBe(false);
  });
});
