import type { Hono } from "hono";
import { todayInSeoul } from "@iib/domain";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getLogger, getSupabase, getUser, type AppEnv } from "@/backend/hono/context";
import { companiesErrorCodes, type CompaniesServiceError } from "@/features/companies/backend/error";
import { createCompaniesRepository } from "@/features/companies/backend/repository";
import {
  CompanySummaryQuerySchema,
  DisclosuresQuerySchema,
  FinancialsQuerySchema,
  QuotesQuerySchema,
  SecurityIdParamSchema,
  TickerParamSchema,
} from "@/features/companies/backend/schema";
import {
  getBelongingChains,
  getCompanySummary,
  getDisclosures,
  getFinancials,
  getQuotes,
} from "@/features/companies/backend/service";

/** 500대만 에러 로깅(400/404/409는 사용자 입력·정상 분기라 로깅 불필요) — 공통 헬퍼(hono-backend-guide 컨벤션). */
const logIfServerError = (
  logger: ReturnType<typeof getLogger>,
  label: string,
  result: { ok: boolean },
) => {
  if (!result.ok) {
    const errorResult = result as ErrorResult<CompaniesServiceError, unknown>;
    if (errorResult.status >= 500) {
      logger.error(`[${label}] failed`, errorResult.error);
    }
  }
};

export const registerCompaniesRoutes = (app: Hono<AppEnv>) => {
  app.get("/companies/:ticker", async (c) => {
    const parsedParam = TickerParamSchema.safeParse({ ticker: c.req.param("ticker") });
    const parsedQuery = CompanySummaryQuerySchema.safeParse(c.req.query());

    if (!parsedParam.success || !parsedQuery.success) {
      return respond(
        c,
        failure(
          400,
          companiesErrorCodes.invalidRequest,
          "티커 또는 market 파라미터가 올바르지 않습니다.",
          (!parsedParam.success ? parsedParam.error : parsedQuery.error!).format(),
        ),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repository = createCompaniesRepository(supabase);

    const result = await getCompanySummary(repository, {
      ticker: parsedParam.data.ticker,
      market: parsedQuery.data.market,
    });

    logIfServerError(logger, "companies/:ticker", result);

    return respond(c, result);
  });

  app.get("/securities/:securityId/financials", async (c) => {
    const parsedParam = SecurityIdParamSchema.safeParse({ securityId: c.req.param("securityId") });
    const parsedQuery = FinancialsQuerySchema.safeParse(c.req.query());

    if (!parsedParam.success || !parsedQuery.success) {
      return respond(
        c,
        failure(
          400,
          companiesErrorCodes.invalidRequest,
          "securityId 또는 조회 기간 파라미터가 올바르지 않습니다.",
          (!parsedParam.success ? parsedParam.error : parsedQuery.error!).format(),
        ),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repository = createCompaniesRepository(supabase);
    const currentYear = Number(todayInSeoul(new Date()).slice(0, 4));

    const result = await getFinancials(repository, {
      securityId: parsedParam.data.securityId,
      query: parsedQuery.data,
      currentYear,
    });

    logIfServerError(logger, "securities/:securityId/financials", result);

    return respond(c, result);
  });

  app.get("/securities/:securityId/disclosures", async (c) => {
    const parsedParam = SecurityIdParamSchema.safeParse({ securityId: c.req.param("securityId") });
    const parsedQuery = DisclosuresQuerySchema.safeParse(c.req.query());

    if (!parsedParam.success || !parsedQuery.success) {
      return respond(
        c,
        failure(
          400,
          companiesErrorCodes.invalidRequest,
          "securityId 또는 page 파라미터가 올바르지 않습니다.",
          (!parsedParam.success ? parsedParam.error : parsedQuery.error!).format(),
        ),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repository = createCompaniesRepository(supabase);

    const result = await getDisclosures(repository, {
      securityId: parsedParam.data.securityId,
      page: parsedQuery.data.page,
    });

    logIfServerError(logger, "securities/:securityId/disclosures", result);

    return respond(c, result);
  });

  app.get("/securities/:securityId/quotes", async (c) => {
    const parsedParam = SecurityIdParamSchema.safeParse({ securityId: c.req.param("securityId") });
    const parsedQuery = QuotesQuerySchema.safeParse(c.req.query());

    if (!parsedParam.success || !parsedQuery.success) {
      return respond(
        c,
        failure(
          400,
          companiesErrorCodes.invalidRequest,
          "securityId 또는 조회 기간 파라미터가 올바르지 않습니다.",
          (!parsedParam.success ? parsedParam.error : parsedQuery.error!).format(),
        ),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repository = createCompaniesRepository(supabase);
    const today = todayInSeoul(new Date());

    const result = await getQuotes(repository, {
      securityId: parsedParam.data.securityId,
      query: parsedQuery.data,
      today,
    });

    logIfServerError(logger, "securities/:securityId/quotes", result);

    return respond(c, result);
  });

  app.get("/securities/:securityId/valuechains", async (c) => {
    const parsedParam = SecurityIdParamSchema.safeParse({ securityId: c.req.param("securityId") });

    if (!parsedParam.success) {
      return respond(
        c,
        failure(
          400,
          companiesErrorCodes.invalidRequest,
          "securityId 파라미터가 올바르지 않습니다.",
          parsedParam.error.format(),
        ),
      );
    }

    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repository = createCompaniesRepository(supabase);
    const user = getUser(c);

    const result = await getBelongingChains(repository, {
      securityId: parsedParam.data.securityId,
      currentUserId: user?.id ?? null,
    });

    logIfServerError(logger, "securities/:securityId/valuechains", result);

    return respond(c, result);
  });
};
