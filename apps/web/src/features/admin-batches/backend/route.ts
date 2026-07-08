import type { Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import { withAdminAuth } from "@/backend/middleware/admin";
import { adminBatchesErrorCodes, type AdminBatchesServiceError } from "@/features/admin-batches/backend/error";
import {
  countBackfillCheckpoints,
  findLatestBackfillRun,
  findRunById,
  listFailuresByRun,
  listRunSummaries,
} from "@/features/admin-batches/backend/repository";
import {
  BatchFailuresQuerySchema,
  BatchRunsListQuerySchema,
  RunIdParamSchema,
} from "@/features/admin-batches/backend/schema";
import {
  getBackfillProgress,
  getBatchRunDetail,
  listBatchRunFailures,
  listBatchRuns,
} from "@/features/admin-batches/backend/service";

const ADMIN_BATCHES_BASE_PATH = "/admin/batches";

/** 404(RUN_NOT_FOUND)는 정상적인 비즈니스 분기이므로 info 레벨, 그 외(500)는 error 레벨로 로깅한다. */
const INFO_LEVEL_CODES: AdminBatchesServiceError[] = [
  adminBatchesErrorCodes.validationError,
  adminBatchesErrorCodes.runNotFound,
];

export const registerAdminBatchRoutes = (app: Hono<AppEnv>) => {
  // 그룹 미들웨어 — 이 경로 이하 전체에 Admin 인증을 선적용한다(BR-2).
  app.use(`${ADMIN_BATCHES_BASE_PATH}/*`, withAdminAuth());

  // GET 전용 라우트만 등록한다 — 재실행 등 쓰기 엔드포인트는 존재하지 않는다(E7·BR-1).

  app.get(`${ADMIN_BATCHES_BASE_PATH}/runs`, async (c) => {
    const parsed = BatchRunsListQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return respond(
        c,
        failure(
          400,
          adminBatchesErrorCodes.validationError,
          "요청 쿼리 형식이 올바르지 않습니다.",
          parsed.error.format(),
        ),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);

    const result = await listBatchRuns(
      {
        listRunSummaries: (params) => listRunSummaries(supabase, params),
        findRunById: (runId) => findRunById(supabase, runId),
        listFailuresByRun: (runId, params) => listFailuresByRun(supabase, runId, params),
        countBackfillCheckpoints: () => countBackfillCheckpoints(supabase),
        findLatestBackfillRun: () => findLatestBackfillRun(supabase),
      },
      parsed.data,
      new Date(),
    );

    logResult(logger, "[admin-batches/runs]", result, { debugOnSuccess: true });
    return respond(c, result);
  });

  app.get(`${ADMIN_BATCHES_BASE_PATH}/runs/:runId`, async (c) => {
    const runIdParsed = RunIdParamSchema.safeParse(c.req.param("runId"));
    if (!runIdParsed.success) {
      return respond(
        c,
        failure(400, adminBatchesErrorCodes.validationError, "runId 형식이 올바르지 않습니다."),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);

    const result = await getBatchRunDetail(
      {
        listRunSummaries: (params) => listRunSummaries(supabase, params),
        findRunById: (runId) => findRunById(supabase, runId),
        listFailuresByRun: (runId, params) => listFailuresByRun(supabase, runId, params),
        countBackfillCheckpoints: () => countBackfillCheckpoints(supabase),
        findLatestBackfillRun: () => findLatestBackfillRun(supabase),
      },
      runIdParsed.data,
    );

    logResult(logger, "[admin-batches/runs/:runId]", result);
    return respond(c, result);
  });

  app.get(`${ADMIN_BATCHES_BASE_PATH}/runs/:runId/failures`, async (c) => {
    const runIdParsed = RunIdParamSchema.safeParse(c.req.param("runId"));
    if (!runIdParsed.success) {
      return respond(
        c,
        failure(400, adminBatchesErrorCodes.validationError, "runId 형식이 올바르지 않습니다."),
      );
    }

    const queryParsed = BatchFailuresQuerySchema.safeParse(c.req.query());
    if (!queryParsed.success) {
      return respond(
        c,
        failure(
          400,
          adminBatchesErrorCodes.validationError,
          "요청 쿼리 형식이 올바르지 않습니다.",
          queryParsed.error.format(),
        ),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);

    const result = await listBatchRunFailures(
      {
        listRunSummaries: (params) => listRunSummaries(supabase, params),
        findRunById: (runId) => findRunById(supabase, runId),
        listFailuresByRun: (runId, params) => listFailuresByRun(supabase, runId, params),
        countBackfillCheckpoints: () => countBackfillCheckpoints(supabase),
        findLatestBackfillRun: () => findLatestBackfillRun(supabase),
      },
      runIdParsed.data,
      queryParsed.data,
    );

    logResult(logger, "[admin-batches/runs/:runId/failures]", result);
    return respond(c, result);
  });

  app.get(`${ADMIN_BATCHES_BASE_PATH}/backfill/progress`, async (c) => {
    const supabase = getSupabase(c);
    const logger = getLogger(c);

    const result = await getBackfillProgress({
      listRunSummaries: (params) => listRunSummaries(supabase, params),
      findRunById: (runId) => findRunById(supabase, runId),
      listFailuresByRun: (runId, params) => listFailuresByRun(supabase, runId, params),
      countBackfillCheckpoints: () => countBackfillCheckpoints(supabase),
      findLatestBackfillRun: () => findLatestBackfillRun(supabase),
    });

    logResult(logger, "[admin-batches/backfill/progress]", result, { debugOnSuccess: true });
    return respond(c, result);
  });
};

type LoggableResult = { ok: boolean } & Record<string, unknown>;

const logResult = (
  logger: ReturnType<typeof getLogger>,
  scope: string,
  result: LoggableResult,
  options?: { debugOnSuccess?: boolean },
) => {
  if (result.ok) {
    if (options?.debugOnSuccess) {
      logger.debug(`${scope} succeeded`);
    }
    return;
  }
  const errorResult = result as ErrorResult<AdminBatchesServiceError, unknown>;
  const isInfoLevel = INFO_LEVEL_CODES.includes(errorResult.error.code);
  if (isInfoLevel) {
    logger.info(`${scope} request rejected`, errorResult.error);
  } else {
    logger.error(`${scope} failed`, errorResult.error);
  }
};
