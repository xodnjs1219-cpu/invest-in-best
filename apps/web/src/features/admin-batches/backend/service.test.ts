import { BATCH_RUNS_DEFAULT_LOOKBACK_DAYS } from "@iib/domain";
import { describe, expect, it, vi } from "vitest";
import { adminBatchesErrorCodes } from "@/features/admin-batches/backend/error";
import type { ListRunSummariesParams } from "@/features/admin-batches/backend/repository";
import type {
  AdminBatchesRepositoryDeps,
} from "@/features/admin-batches/backend/service";
import {
  getBackfillProgress,
  getBatchRunDetail,
  listBatchRunFailures,
  listBatchRuns,
} from "@/features/admin-batches/backend/service";
import type {
  BackfillLatestRunRow,
  BatchItemFailureRow,
  BatchRunDetailRow,
  BatchRunSummaryRow,
} from "@/features/admin-batches/backend/schema";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-08T00:00:00.000Z");

const buildSummaryRow = (overrides: Partial<BatchRunSummaryRow> = {}): BatchRunSummaryRow => ({
  id: RUN_ID,
  job_type: "collect_financials",
  status: "partial_success",
  started_at: "2026-07-05T02:00:00+09:00",
  finished_at: "2026-07-05T02:41:12+09:00",
  processed_count: 2480,
  failed_count: 12,
  is_carried_over: true,
  target_market: "KRX",
  has_error_log: true,
  created_at: "2026-07-05T02:00:00+09:00",
  ...overrides,
});

const buildDetailRow = (overrides: Partial<BatchRunDetailRow> = {}): BatchRunDetailRow => ({
  id: RUN_ID,
  job_type: "collect_financials",
  status: "partial_success",
  started_at: "2026-07-05T02:00:00+09:00",
  finished_at: "2026-07-05T02:41:12+09:00",
  processed_count: 2480,
  failed_count: 12,
  is_carried_over: true,
  target_market: "KRX",
  error_log: "OpenDART 일일 한도 도달로 214건 이월",
  ...overrides,
});

const buildFailureRow = (overrides: Partial<BatchItemFailureRow> = {}): BatchItemFailureRow => ({
  id: "22222222-2222-4222-8222-222222222222",
  attempt_count: 3,
  last_error: "HTTP 429 rate limited",
  is_resolved: false,
  updated_at: "2026-07-05T02:40:58+09:00",
  securities: { id: "33333333-3333-4333-8333-333333333333", ticker: "005930", name: "삼성전자", market: "KRX" },
  ...overrides,
});

const buildBackfillLatestRunRow = (overrides: Partial<BackfillLatestRunRow> = {}): BackfillLatestRunRow => ({
  id: RUN_ID,
  status: "partial_success",
  started_at: "2026-07-04T09:00:00+09:00",
  finished_at: "2026-07-04T18:20:00+09:00",
  ...overrides,
});

const createDeps = (overrides?: Partial<AdminBatchesRepositoryDeps>): AdminBatchesRepositoryDeps => ({
  listRunSummaries: vi.fn(async () => ({ ok: true as const, rows: [], totalCount: 0 })),
  findRunById: vi.fn(async () => ({ ok: true as const, row: null })),
  listFailuresByRun: vi.fn(async () => ({ ok: true as const, rows: [], totalCount: 0 })),
  countBackfillCheckpoints: vi.fn(async () => ({ ok: true as const, total: 0, completed: 0 })),
  findLatestBackfillRun: vi.fn(async () => ({ ok: true as const, row: null })),
  ...overrides,
});

describe("listBatchRuns", () => {
  it("from/to 미지정 시 repository에 fromIso=now-14일, toIso=undefined가 전달된다(R-4)", async () => {
    const listRunSummaries = vi.fn(async (_params: ListRunSummariesParams) => ({ ok: true as const, rows: [], totalCount: 0 }));
    const deps = createDeps({ listRunSummaries });

    await listBatchRuns(deps, { page: 1, pageSize: 20 }, NOW);

    expect(listRunSummaries).toHaveBeenCalledWith(
      expect.objectContaining({
        toIso: undefined,
      }),
    );
    const callArg = listRunSummaries.mock.calls[0][0];
    const expectedFrom = new Date(NOW.getTime() - BATCH_RUNS_DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    expect(callArg.fromIso).toBe(expectedFrom);
  });

  it("from이 명시되면 기본 기간을 덮어쓰지 않고 그대로 전달된다", async () => {
    const listRunSummaries = vi.fn(async (_params: ListRunSummariesParams) => ({ ok: true as const, rows: [], totalCount: 0 }));
    const deps = createDeps({ listRunSummaries });

    await listBatchRuns(
      deps,
      { page: 1, pageSize: 20, from: "2026-06-01T00:00:00.000Z" },
      NOW,
    );

    const callArg = listRunSummaries.mock.calls[0][0];
    expect(callArg.fromIso).toBe("2026-06-01T00:00:00.000Z");
  });

  it("page=3, pageSize=20 → offset=40 계산", async () => {
    const listRunSummaries = vi.fn(async (_params: ListRunSummariesParams) => ({ ok: true as const, rows: [], totalCount: 0 }));
    const deps = createDeps({ listRunSummaries });

    await listBatchRuns(deps, { page: 3, pageSize: 20 }, NOW);

    const callArg = listRunSummaries.mock.calls[0][0];
    expect(callArg.offset).toBe(40);
    expect(callArg.limit).toBe(20);
  });

  it("목록 0건이면 success({runs:[], pagination.totalCount:0})를 반환한다(E1)", async () => {
    const deps = createDeps();

    const result = await listBatchRuns(deps, { page: 1, pageSize: 20 }, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.runs).toEqual([]);
      expect(result.data.pagination.totalCount).toBe(0);
    }
  });

  it("running 행(finished_at:null)은 DTO finishedAt:null 그대로 통과한다(E2)", async () => {
    const row = buildSummaryRow({ status: "running", finished_at: null, has_error_log: false });
    const deps = createDeps({
      listRunSummaries: vi.fn(async () => ({ ok: true as const, rows: [row], totalCount: 1 })),
    });

    const result = await listBatchRuns(deps, { page: 1, pageSize: 20 }, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.runs[0].finishedAt).toBeNull();
      expect(result.data.runs[0].status).toBe("running");
    }
  });

  it("has_error_log → hasErrorLog로 매핑되고 errorLog 필드는 존재하지 않는다(BR-6)", async () => {
    const row = buildSummaryRow();
    const deps = createDeps({
      listRunSummaries: vi.fn(async () => ({ ok: true as const, rows: [row], totalCount: 1 })),
    });

    const result = await listBatchRuns(deps, { page: 1, pageSize: 20 }, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.runs[0].hasErrorLog).toBe(true);
      expect("errorLog" in result.data.runs[0]).toBe(false);
    }
  });

  it("repository {ok:false} 시 failure(500, INTERNAL_ERROR)를 반환한다(E12)", async () => {
    const deps = createDeps({
      listRunSummaries: vi.fn(async () => ({ ok: false as const, message: "db down" })),
    });

    const result = await listBatchRuns(deps, { page: 1, pageSize: 20 }, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminBatchesErrorCodes.internalError);
    }
  });
});

describe("getBatchRunDetail", () => {
  it("미존재 runId → 404 RUN_NOT_FOUND(E8)", async () => {
    const deps = createDeps({ findRunById: vi.fn(async () => ({ ok: true as const, row: null })) });

    const result = await getBatchRunDetail(deps, RUN_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(adminBatchesErrorCodes.runNotFound);
    }
  });

  it("존재하는 run은 errorLog 본문을 포함해 200을 반환한다", async () => {
    const row = buildDetailRow();
    const deps = createDeps({ findRunById: vi.fn(async () => ({ ok: true as const, row })) });

    const result = await getBatchRunDetail(deps, RUN_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.run.errorLog).toBe("OpenDART 일일 한도 도달로 214건 이월");
    }
  });

  it("repository {ok:false} 시 500을 반환한다", async () => {
    const deps = createDeps({ findRunById: vi.fn(async () => ({ ok: false as const, message: "fail" })) });

    const result = await getBatchRunDetail(deps, RUN_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });
});

describe("listBatchRunFailures", () => {
  it("미존재 runId → 404(실패 목록 조회 미수행, R-10)", async () => {
    const listFailuresByRun = vi.fn(async () => ({ ok: true as const, rows: [], totalCount: 0 }));
    const deps = createDeps({
      findRunById: vi.fn(async () => ({ ok: true as const, row: null })),
      listFailuresByRun,
    });

    const result = await listBatchRunFailures(deps, RUN_ID, { page: 1, pageSize: 20 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
    expect(listFailuresByRun).not.toHaveBeenCalled();
  });

  it("실패 0건인 실존 run은 200 + 빈 배열을 반환한다", async () => {
    const deps = createDeps({
      findRunById: vi.fn(async () => ({ ok: true as const, row: buildDetailRow() })),
      listFailuresByRun: vi.fn(async () => ({ ok: true as const, rows: [], totalCount: 0 })),
    });

    const result = await listBatchRunFailures(deps, RUN_ID, { page: 1, pageSize: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.failures).toEqual([]);
    }
  });

  it("securities NULL 행은 security:null로, 존재 행은 4필드 매핑된다(BR-8)", async () => {
    const rows = [
      buildFailureRow({ securities: null, last_error: "환율 응답 스키마 불일치", is_resolved: true }),
      buildFailureRow(),
    ];
    const deps = createDeps({
      findRunById: vi.fn(async () => ({ ok: true as const, row: buildDetailRow() })),
      listFailuresByRun: vi.fn(async () => ({ ok: true as const, rows, totalCount: 2 })),
    });

    const result = await listBatchRunFailures(deps, RUN_ID, { page: 1, pageSize: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.failures[0].security).toBeNull();
      expect(result.data.failures[0].isResolved).toBe(true);
      expect(result.data.failures[1].security).toEqual({
        id: "33333333-3333-4333-8333-333333333333",
        ticker: "005930",
        name: "삼성전자",
        market: "KRX",
      });
    }
  });
});

describe("getBackfillProgress", () => {
  it("total=3200, completed=2710 → isCompleted:false", async () => {
    const deps = createDeps({
      countBackfillCheckpoints: vi.fn(async () => ({ ok: true as const, total: 3200, completed: 2710 })),
      findLatestBackfillRun: vi.fn(async () => ({ ok: true as const, row: buildBackfillLatestRunRow() })),
    });

    const result = await getBackfillProgress(deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isCompleted).toBe(false);
      expect(result.data.totalCheckpoints).toBe(3200);
      expect(result.data.completedCheckpoints).toBe(2710);
    }
  });

  it("total=completed=3200 → isCompleted:true", async () => {
    const deps = createDeps({
      countBackfillCheckpoints: vi.fn(async () => ({ ok: true as const, total: 3200, completed: 3200 })),
      findLatestBackfillRun: vi.fn(async () => ({ ok: true as const, row: buildBackfillLatestRunRow() })),
    });

    const result = await getBackfillProgress(deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isCompleted).toBe(true);
    }
  });

  it("total=0 → 0/0, isCompleted:false(E11)", async () => {
    const deps = createDeps({
      countBackfillCheckpoints: vi.fn(async () => ({ ok: true as const, total: 0, completed: 0 })),
      findLatestBackfillRun: vi.fn(async () => ({ ok: true as const, row: null })),
    });

    const result = await getBackfillProgress(deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalCheckpoints).toBe(0);
      expect(result.data.completedCheckpoints).toBe(0);
      expect(result.data.isCompleted).toBe(false);
    }
  });

  it("백필 실행 이력 없음 → latestRun:null", async () => {
    const deps = createDeps({
      countBackfillCheckpoints: vi.fn(async () => ({ ok: true as const, total: 0, completed: 0 })),
      findLatestBackfillRun: vi.fn(async () => ({ ok: true as const, row: null })),
    });

    const result = await getBackfillProgress(deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.latestRun).toBeNull();
    }
  });

  it("repository {ok:false} 시 failure(500, INTERNAL_ERROR)를 반환한다(E12)", async () => {
    const deps = createDeps({
      countBackfillCheckpoints: vi.fn(async () => ({ ok: false as const, message: "fail" })),
    });

    const result = await getBackfillProgress(deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(adminBatchesErrorCodes.internalError);
    }
  });
});
