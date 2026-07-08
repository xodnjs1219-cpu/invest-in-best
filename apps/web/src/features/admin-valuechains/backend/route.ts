import type { Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import { withAdminAuth } from "@/backend/middleware/admin";
import { adminChainErrorCodes, type AdminChainServiceError } from "@/features/admin-valuechains/backend/error";
import { createAdminValuechainsRepository } from "@/features/admin-valuechains/backend/repository";
import { AdminChainListQuerySchema, ChainIdParamSchema } from "@/features/admin-valuechains/backend/schema";
import { archiveChain, listAdminChains } from "@/features/admin-valuechains/backend/service";

const ADMIN_VALUECHAINS_BASE_PATH = "/admin/valuechains";

/**
 * admin-valuechains 라우터(UC-021 plan 모듈 M12) — `GET /admin/valuechains`(목록),
 * `DELETE /admin/valuechains/:chainId`(보관). 그룹 전체에 `withAdminAuth()`를 선적용한다(BR-1).
 */
export const registerAdminValuechainRoutes = (app: Hono<AppEnv>) => {
  app.use(`${ADMIN_VALUECHAINS_BASE_PATH}/*`, withAdminAuth());

  app.get(ADMIN_VALUECHAINS_BASE_PATH, async (c) => {
    const queryParsed = AdminChainListQuerySchema.safeParse(c.req.query());
    if (!queryParsed.success) {
      return respond(
        c,
        failure(400, adminChainErrorCodes.invalidRequest, "쿼리 파라미터가 올바르지 않습니다.", queryParsed.error.format()),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repo = createAdminValuechainsRepository(supabase);

    const result = await listAdminChains(repo, { includeArchived: queryParsed.data.includeArchived });

    if (!result.ok) {
      const errorResult = result as ErrorResult<AdminChainServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[admin-valuechains/list] failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  app.delete(`${ADMIN_VALUECHAINS_BASE_PATH}/:chainId`, async (c) => {
    const paramsParsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!paramsParsed.success) {
      return respond(c, failure(400, adminChainErrorCodes.invalidRequest, "잘못된 밸류체인 경로입니다."));
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repo = createAdminValuechainsRepository(supabase);

    const result = await archiveChain(repo, paramsParsed.data.chainId);

    if (!result.ok) {
      const errorResult = result as ErrorResult<AdminChainServiceError, unknown>;
      if (result.status >= 500) {
        logger.error("[admin-valuechains/archive] failed", errorResult.error);
      }
    }

    return respond(c, result);
  });
};
