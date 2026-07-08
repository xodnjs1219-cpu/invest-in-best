import {
  ADMIN_BATCH_FAILURES_PAGE_SIZE_DEFAULT,
  ADMIN_BATCH_FAILURES_PAGE_SIZE_MAX,
  ADMIN_BATCH_RUNS_PAGE_SIZE_DEFAULT,
  ADMIN_BATCH_RUNS_PAGE_SIZE_MAX,
  BATCH_JOB_TYPES,
  BATCH_RUN_STATUSES,
} from "@iib/domain";
import { z } from "zod";

// ============================================
// Request Schema (camelCase)
// ============================================

/** `GET /admin/batches/runs` 쿼리 스키마(spec API-1, E9, R-4). */
export const BatchRunsListQuerySchema = z
  .object({
    jobType: z.enum(BATCH_JOB_TYPES).optional(),
    status: z.enum(BATCH_RUN_STATUSES).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(ADMIN_BATCH_RUNS_PAGE_SIZE_MAX)
      .default(ADMIN_BATCH_RUNS_PAGE_SIZE_DEFAULT),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from은 to보다 이후일 수 없습니다.",
    path: ["from"],
  });

export type BatchRunsListQuery = z.infer<typeof BatchRunsListQuerySchema>;

/** 경로 파라미터 `:runId` — UUID 형식만 허용. */
export const RunIdParamSchema = z.string().uuid();

/** `GET /admin/batches/runs/:runId/failures` 쿼리 스키마(spec API-3). */
export const BatchFailuresQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ADMIN_BATCH_FAILURES_PAGE_SIZE_MAX)
    .default(ADMIN_BATCH_FAILURES_PAGE_SIZE_DEFAULT),
});

export type BatchFailuresQuery = z.infer<typeof BatchFailuresQuerySchema>;

// ============================================
// Database Row Schema (snake_case — DB와 1:1)
// ============================================

/** `batch_runs_summary` 뷰 행(M3) — 목록 조회 전용, error_log 본문 미포함(BR-6). */
export const BatchRunSummaryRowSchema = z.object({
  id: z.string().uuid(),
  job_type: z.enum(BATCH_JOB_TYPES),
  status: z.enum(BATCH_RUN_STATUSES),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  processed_count: z.number().int(),
  failed_count: z.number().int(),
  is_carried_over: z.boolean(),
  target_market: z.string().nullable(),
  has_error_log: z.boolean(),
  created_at: z.string(),
});

export type BatchRunSummaryRow = z.infer<typeof BatchRunSummaryRowSchema>;

/** `batch_runs` 원본 행(단건) — 상세 조회 전용, error_log 본문 포함(API-2). */
export const BatchRunDetailRowSchema = z.object({
  id: z.string().uuid(),
  job_type: z.enum(BATCH_JOB_TYPES),
  status: z.enum(BATCH_RUN_STATUSES),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  processed_count: z.number().int(),
  failed_count: z.number().int(),
  is_carried_over: z.boolean(),
  target_market: z.string().nullable(),
  error_log: z.string().nullable(),
});

export type BatchRunDetailRow = z.infer<typeof BatchRunDetailRowSchema>;

/** `batch_item_failures` + `securities` 임베드 행(API-3, BR-8). */
export const BatchItemFailureRowSchema = z.object({
  id: z.string().uuid(),
  attempt_count: z.number().int(),
  last_error: z.string().nullable(),
  is_resolved: z.boolean(),
  updated_at: z.string(),
  securities: z
    .object({
      id: z.string().uuid(),
      ticker: z.string(),
      name: z.string(),
      market: z.string(),
    })
    .nullable(),
});

export type BatchItemFailureRow = z.infer<typeof BatchItemFailureRowSchema>;

/** 백필 최신 실행(단건) 행(API-4). */
export const BackfillLatestRunRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(BATCH_RUN_STATUSES),
  started_at: z.string(),
  finished_at: z.string().nullable(),
});

export type BackfillLatestRunRow = z.infer<typeof BackfillLatestRunRowSchema>;

// ============================================
// Response Schema (camelCase — spec §6.2 계약 그대로)
// ============================================

const PaginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalCount: z.number().int().min(0),
});

const BatchRunSummarySchema = z.object({
  id: z.string(),
  jobType: z.enum(BATCH_JOB_TYPES),
  status: z.enum(BATCH_RUN_STATUSES),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  processedCount: z.number().int(),
  failedCount: z.number().int(),
  isCarriedOver: z.boolean(),
  targetMarket: z.string().nullable(),
  hasErrorLog: z.boolean(),
});

export type BatchRunSummaryDto = z.infer<typeof BatchRunSummarySchema>;

export const BatchRunsListResponseSchema = z.object({
  runs: z.array(BatchRunSummarySchema),
  pagination: PaginationSchema,
});

export type BatchRunsListResponse = z.infer<typeof BatchRunsListResponseSchema>;

const BatchRunDetailSchema = z.object({
  id: z.string(),
  jobType: z.enum(BATCH_JOB_TYPES),
  status: z.enum(BATCH_RUN_STATUSES),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  processedCount: z.number().int(),
  failedCount: z.number().int(),
  isCarriedOver: z.boolean(),
  targetMarket: z.string().nullable(),
  errorLog: z.string().nullable(),
});

export type BatchRunDetailDto = z.infer<typeof BatchRunDetailSchema>;

export const BatchRunDetailResponseSchema = z.object({
  run: BatchRunDetailSchema,
});

export type BatchRunDetailResponse = z.infer<typeof BatchRunDetailResponseSchema>;

const SecuritySummarySchema = z.object({
  id: z.string(),
  ticker: z.string(),
  name: z.string(),
  market: z.string(),
});

const BatchItemFailureSchema = z.object({
  id: z.string(),
  security: SecuritySummarySchema.nullable(),
  attemptCount: z.number().int(),
  lastError: z.string().nullable(),
  isResolved: z.boolean(),
  updatedAt: z.string(),
});

export type BatchItemFailureDto = z.infer<typeof BatchItemFailureSchema>;

export const BatchRunFailuresResponseSchema = z.object({
  failures: z.array(BatchItemFailureSchema),
  pagination: PaginationSchema,
});

export type BatchRunFailuresResponse = z.infer<typeof BatchRunFailuresResponseSchema>;

const BackfillLatestRunSchema = z.object({
  id: z.string(),
  status: z.enum(BATCH_RUN_STATUSES),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const BackfillProgressResponseSchema = z.object({
  totalCheckpoints: z.number().int().min(0),
  completedCheckpoints: z.number().int().min(0),
  isCompleted: z.boolean(),
  latestRun: BackfillLatestRunSchema.nullable(),
});

export type BackfillProgressResponse = z.infer<typeof BackfillProgressResponseSchema>;
