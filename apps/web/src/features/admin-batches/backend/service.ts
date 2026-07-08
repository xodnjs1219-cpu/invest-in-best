import { BATCH_RUNS_DEFAULT_LOOKBACK_DAYS } from "@iib/domain";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import { adminBatchesErrorCodes, type AdminBatchesServiceError } from "@/features/admin-batches/backend/error";
import type {
  BackfillCheckpointCounts,
  ListFailuresByRunParams,
  ListRunSummariesParams,
  RepositoryReadResult,
  RepositorySingleResult,
} from "@/features/admin-batches/backend/repository";
import {
  BatchItemFailureRowSchema,
  BatchRunDetailRowSchema,
  BatchRunSummaryRowSchema,
  type BackfillLatestRunRow,
  type BackfillProgressResponse,
  type BatchFailuresQuery,
  type BatchItemFailureRow,
  type BatchRunDetailResponse,
  type BatchRunDetailRow,
  type BatchRunFailuresResponse,
  type BatchRunsListQuery,
  type BatchRunsListResponse,
  type BatchRunSummaryDto,
  type BatchRunSummaryRow,
} from "@/features/admin-batches/backend/schema";

/**
 * service가 의존하는 repository 함수 시그니처 — 테스트에서 mock 주입이 가능하도록
 * 인터페이스 타입으로 분리한다(service.ts는 Supabase 쿼리 문법을 알지 못한다).
 */
export type AdminBatchesRepositoryDeps = {
  listRunSummaries: (params: ListRunSummariesParams) => Promise<RepositoryReadResult<BatchRunSummaryRow[]>>;
  findRunById: (runId: string) => Promise<RepositorySingleResult<BatchRunDetailRow>>;
  listFailuresByRun: (
    runId: string,
    params: ListFailuresByRunParams,
  ) => Promise<RepositoryReadResult<BatchItemFailureRow[]>>;
  countBackfillCheckpoints: () => Promise<
    { ok: true } & BackfillCheckpointCounts | { ok: false; message: string }
  >;
  findLatestBackfillRun: () => Promise<RepositorySingleResult<BackfillLatestRunRow>>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toSummaryDto = (row: BatchRunSummaryRow): BatchRunSummaryDto => ({
  id: row.id,
  jobType: row.job_type,
  status: row.status,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  processedCount: row.processed_count,
  failedCount: row.failed_count,
  isCarriedOver: row.is_carried_over,
  targetMarket: row.target_market,
  hasErrorLog: row.has_error_log,
});

/**
 * 배치 실행 이력 목록 조회(spec API-1, R-4). `from` 미지정 시 기본 조회 기간(상수)을 적용한다.
 */
export const listBatchRuns = async (
  deps: AdminBatchesRepositoryDeps,
  query: BatchRunsListQuery,
  now: Date,
): Promise<HandlerResult<BatchRunsListResponse, AdminBatchesServiceError, unknown>> => {
  const fromIso = query.from ?? new Date(now.getTime() - BATCH_RUNS_DEFAULT_LOOKBACK_DAYS * MS_PER_DAY).toISOString();
  const toIso = query.to;
  const offset = (query.page - 1) * query.pageSize;

  const readResult = await deps.listRunSummaries({
    jobType: query.jobType,
    status: query.status,
    fromIso,
    toIso,
    limit: query.pageSize,
    offset,
  });

  if (!readResult.ok) {
    return failure(500, adminBatchesErrorCodes.internalError, readResult.message);
  }

  const parsedRows: BatchRunSummaryRow[] = [];
  for (const row of readResult.rows) {
    const rowCheck = BatchRunSummaryRowSchema.safeParse(row);
    if (!rowCheck.success) {
      return failure(
        500,
        adminBatchesErrorCodes.internalError,
        "배치 실행 이력 데이터 형식이 올바르지 않습니다.",
        rowCheck.error.format(),
      );
    }
    parsedRows.push(rowCheck.data);
  }

  return success<BatchRunsListResponse>({
    runs: parsedRows.map(toSummaryDto),
    pagination: { page: query.page, pageSize: query.pageSize, totalCount: readResult.totalCount },
  });
};

/** 배치 실행 상세 조회(spec API-2, E8). */
export const getBatchRunDetail = async (
  deps: AdminBatchesRepositoryDeps,
  runId: string,
): Promise<HandlerResult<BatchRunDetailResponse, AdminBatchesServiceError, unknown>> => {
  const readResult = await deps.findRunById(runId);
  if (!readResult.ok) {
    return failure(500, adminBatchesErrorCodes.internalError, readResult.message);
  }

  if (!readResult.row) {
    return failure(404, adminBatchesErrorCodes.runNotFound, "실행 이력을 찾을 수 없습니다.");
  }

  const rowCheck = BatchRunDetailRowSchema.safeParse(readResult.row);
  if (!rowCheck.success) {
    return failure(
      500,
      adminBatchesErrorCodes.internalError,
      "배치 실행 상세 데이터 형식이 올바르지 않습니다.",
      rowCheck.error.format(),
    );
  }

  const row = rowCheck.data;
  return success<BatchRunDetailResponse>({
    run: {
      id: row.id,
      jobType: row.job_type,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      processedCount: row.processed_count,
      failedCount: row.failed_count,
      isCarriedOver: row.is_carried_over,
      targetMarket: row.target_market,
      errorLog: row.error_log,
    },
  });
};

/** 실행별 종목 단위 실패 목록 조회(spec API-3, R-10 — run 존재 확인 선행). */
export const listBatchRunFailures = async (
  deps: AdminBatchesRepositoryDeps,
  runId: string,
  query: BatchFailuresQuery,
): Promise<HandlerResult<BatchRunFailuresResponse, AdminBatchesServiceError, unknown>> => {
  const runResult = await deps.findRunById(runId);
  if (!runResult.ok) {
    return failure(500, adminBatchesErrorCodes.internalError, runResult.message);
  }
  if (!runResult.row) {
    return failure(404, adminBatchesErrorCodes.runNotFound, "실행 이력을 찾을 수 없습니다.");
  }

  const offset = (query.page - 1) * query.pageSize;
  const readResult = await deps.listFailuresByRun(runId, { limit: query.pageSize, offset });
  if (!readResult.ok) {
    return failure(500, adminBatchesErrorCodes.internalError, readResult.message);
  }

  const parsedRows: BatchItemFailureRow[] = [];
  for (const row of readResult.rows) {
    const rowCheck = BatchItemFailureRowSchema.safeParse(row);
    if (!rowCheck.success) {
      return failure(
        500,
        adminBatchesErrorCodes.internalError,
        "종목 단위 실패 데이터 형식이 올바르지 않습니다.",
        rowCheck.error.format(),
      );
    }
    parsedRows.push(rowCheck.data);
  }

  return success<BatchRunFailuresResponse>({
    failures: parsedRows.map((row) => ({
      id: row.id,
      security: row.securities,
      attemptCount: row.attempt_count,
      lastError: row.last_error,
      isResolved: row.is_resolved,
      updatedAt: row.updated_at,
    })),
    pagination: { page: query.page, pageSize: query.pageSize, totalCount: readResult.totalCount },
  });
};

/** 백필 진행 현황 조회(spec API-4, BR-9, E11). */
export const getBackfillProgress = async (
  deps: AdminBatchesRepositoryDeps,
): Promise<HandlerResult<BackfillProgressResponse, AdminBatchesServiceError, unknown>> => {
  const [countsResult, latestRunResult] = await Promise.all([
    deps.countBackfillCheckpoints(),
    deps.findLatestBackfillRun(),
  ]);

  if (!countsResult.ok) {
    return failure(500, adminBatchesErrorCodes.internalError, countsResult.message);
  }
  if (!latestRunResult.ok) {
    return failure(500, adminBatchesErrorCodes.internalError, latestRunResult.message);
  }

  const { total, completed } = countsResult;
  const isCompleted = total > 0 && completed === total;
  const latestRun = latestRunResult.row;

  return success<BackfillProgressResponse>({
    totalCheckpoints: total,
    completedCheckpoints: completed,
    isCompleted,
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          startedAt: latestRun.started_at,
          finishedAt: latestRun.finished_at,
        }
      : null,
  });
};
