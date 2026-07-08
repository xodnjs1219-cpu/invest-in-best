import type { Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getAdminUser, getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import { withAdminAuth } from "@/backend/middleware/admin";
import { adminLlmProposalErrorCodes, type AdminLlmProposalServiceError } from "@/features/admin-llm-proposals/backend/error";
import {
  approveProposalRpc,
  findProposalStatus,
  listProposalRows,
  rejectProposalPending,
} from "@/features/admin-llm-proposals/backend/repository";
import {
  ProposalIdParamSchema,
  ProposalListQuerySchema,
  ProposalRejectRequestSchema,
} from "@/features/admin-llm-proposals/backend/schema";
import { approveProposal, listProposals, rejectProposal } from "@/features/admin-llm-proposals/backend/service";

const ADMIN_LLM_PROPOSALS_BASE_PATH = "/admin/llm-proposals";

/** 409/422는 정상적인 비즈니스 분기이므로 info 레벨, 그 외(500)는 error 레벨로 로깅한다. */
const INFO_LEVEL_CODES: AdminLlmProposalServiceError[] = [
  adminLlmProposalErrorCodes.invalidRequest,
  adminLlmProposalErrorCodes.proposalNotFound,
  adminLlmProposalErrorCodes.proposalAlreadyProcessed,
  adminLlmProposalErrorCodes.proposalConflict,
  adminLlmProposalErrorCodes.relationTypeInactive,
  adminLlmProposalErrorCodes.chainNotApplicable,
];

export const registerAdminLlmProposalRoutes = (app: Hono<AppEnv>) => {
  // 그룹 미들웨어 — 이 경로 이하 전체에 Admin 인증을 선적용한다(BR-10).
  app.use(`${ADMIN_LLM_PROPOSALS_BASE_PATH}/*`, withAdminAuth());

  app.get(ADMIN_LLM_PROPOSALS_BASE_PATH, async (c) => {
    const parsed = ProposalListQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return respond(
        c,
        failure(
          400,
          adminLlmProposalErrorCodes.invalidRequest,
          "요청 쿼리 형식이 올바르지 않습니다.",
          parsed.error.format(),
        ),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);

    const result = await listProposals(
      {
        listProposalRows: (params) => listProposalRows(supabase, params),
        approveProposalRpc: (params) => approveProposalRpc(supabase, params),
        rejectProposalPending: (params) => rejectProposalPending(supabase, params),
        findProposalStatus: (proposalId) => findProposalStatus(supabase, proposalId),
      },
      parsed.data,
    );

    logResult(logger, "[admin-llm-proposals/list]", result);
    return respond(c, result);
  });

  app.post(`${ADMIN_LLM_PROPOSALS_BASE_PATH}/:proposalId/approve`, async (c) => {
    const proposalIdParsed = ProposalIdParamSchema.safeParse(c.req.param("proposalId"));
    if (!proposalIdParsed.success) {
      return respond(
        c,
        failure(400, adminLlmProposalErrorCodes.invalidRequest, "proposalId 형식이 올바르지 않습니다."),
      );
    }

    const adminUser = getAdminUser(c);
    if (!adminUser) {
      return respond(c, failure(401, "UNAUTHORIZED", "로그인이 필요합니다."));
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);

    const result = await approveProposal(
      {
        listProposalRows: (params) => listProposalRows(supabase, params),
        approveProposalRpc: (params) => approveProposalRpc(supabase, params),
        rejectProposalPending: (params) => rejectProposalPending(supabase, params),
        findProposalStatus: (proposalId) => findProposalStatus(supabase, proposalId),
      },
      { proposalId: proposalIdParsed.data, reviewerId: adminUser.id },
    );

    logResult(logger, "[admin-llm-proposals/approve]", result);
    return respond(c, result);
  });

  app.post(`${ADMIN_LLM_PROPOSALS_BASE_PATH}/:proposalId/reject`, async (c) => {
    const proposalIdParsed = ProposalIdParamSchema.safeParse(c.req.param("proposalId"));
    if (!proposalIdParsed.success) {
      return respond(
        c,
        failure(400, adminLlmProposalErrorCodes.invalidRequest, "proposalId 형식이 올바르지 않습니다."),
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const bodyParsed = ProposalRejectRequestSchema.safeParse(body);
    if (!bodyParsed.success) {
      return respond(
        c,
        failure(
          400,
          adminLlmProposalErrorCodes.invalidRequest,
          "요청 본문 형식이 올바르지 않습니다.",
          bodyParsed.error.format(),
        ),
      );
    }

    const adminUser = getAdminUser(c);
    if (!adminUser) {
      return respond(c, failure(401, "UNAUTHORIZED", "로그인이 필요합니다."));
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);

    const result = await rejectProposal(
      {
        listProposalRows: (params) => listProposalRows(supabase, params),
        approveProposalRpc: (params) => approveProposalRpc(supabase, params),
        rejectProposalPending: (params) => rejectProposalPending(supabase, params),
        findProposalStatus: (proposalId) => findProposalStatus(supabase, proposalId),
      },
      {
        proposalId: proposalIdParsed.data,
        reviewerId: adminUser.id,
        reason: bodyParsed.data.reason,
      },
    );

    if (result.meta?.reason) {
      logger.info("[admin-llm-proposals/reject] reason", {
        proposalId: proposalIdParsed.data,
        reason: result.meta.reason,
      });
    }

    logResult(logger, "[admin-llm-proposals/reject]", result);
    return respond(c, result);
  });
};

type LoggableResult = { ok: boolean } & Record<string, unknown>;

const logResult = (
  logger: ReturnType<typeof getLogger>,
  scope: string,
  result: LoggableResult,
) => {
  if (result.ok) {
    return;
  }
  const errorResult = result as ErrorResult<AdminLlmProposalServiceError, unknown>;
  const isInfoLevel = INFO_LEVEL_CODES.includes(errorResult.error.code);
  if (isInfoLevel) {
    logger.info(`${scope} request rejected`, errorResult.error);
  } else {
    logger.error(`${scope} failed`, errorResult.error);
  }
};
