import type { Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import { securitiesSearchErrorCodes } from "@/features/securities/backend/error";
import { createSecuritiesSearchRepository } from "@/features/securities/backend/repository";
import { SecuritySearchQuerySchema } from "@/features/securities/backend/schema";
import { searchSecurities } from "@/features/securities/backend/service";

export const registerSecuritiesRoutes = (app: Hono<AppEnv>) => {
  app.get("/securities/search", async (c) => {
    // 1. 쿼리 파라미터 Zod 검증 (spec: q 필수·최소 길이, market enum, page 정수)
    const parsed = SecuritySearchQuerySchema.safeParse(c.req.query());

    if (!parsed.success) {
      return respond(
        c,
        failure(
          400,
          securitiesSearchErrorCodes.invalidQuery,
          "검색어 또는 필터 값이 올바르지 않습니다.",
          parsed.error.format(),
        ),
      );
    }

    // 2. 의존성 획득 (조회 전용 공개 API — 인증/인가 검사 없음)
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repository = createSecuritiesSearchRepository(supabase);

    // 3. 서비스 호출
    const result = await searchSecurities(repository, parsed.data);

    // 4. 로깅 (500대만 에러 로깅 — 400 INVALID_QUERY는 사용자 입력 오류라 로깅 불필요)
    if (!result.ok) {
      const errorResult = result as ErrorResult<
        (typeof securitiesSearchErrorCodes)[keyof typeof securitiesSearchErrorCodes],
        unknown
      >;
      if (errorResult.status >= 500) {
        logger.error("[securities/search] search failed", errorResult.error);
      }
    }

    // 5. 응답
    return respond(c, result);
  });
};
