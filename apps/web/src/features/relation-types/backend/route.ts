import type { Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getLogger, getSupabase, getUser, type AppEnv } from "@/backend/hono/context";
import { relationTypeErrorCodes, type RelationTypeServiceError } from "@/features/relation-types/backend/error";
import { createRelationTypeRepository } from "@/features/relation-types/backend/repository";
import { RelationTypeListQuerySchema } from "@/features/relation-types/backend/schema";
import { getRelationTypes } from "@/features/relation-types/backend/service";

/**
 * relation-types 라우터(UC-016 API-1) — `GET /relation-types`.
 * HTTP 파싱/검증·인증 확인·의존성 주입·에러 로깅·respond() 위임만 담당한다(비즈니스 로직은 service.ts).
 */
export const registerRelationTypeRoutes = (app: Hono<AppEnv>) => {
  app.get("/relation-types", async (c) => {
    // 1. 인증 확인 (E9)
    const currentUser = getUser(c);
    if (!currentUser) {
      return respond(c, failure(401, relationTypeErrorCodes.unauthorized, "로그인이 필요합니다."));
    }

    // 2. 쿼리 파라미터 검증
    const parsed = RelationTypeListQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return respond(
        c,
        failure(
          400,
          relationTypeErrorCodes.invalidQuery,
          "쿼리 파라미터가 올바르지 않습니다.",
          parsed.error.format(),
        ),
      );
    }

    // 3. 의존성 획득
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const repository = createRelationTypeRepository(supabase);

    // 4. 서비스 호출
    const result = await getRelationTypes(repository, { activeOnly: parsed.data.active === true });

    // 5. 로깅(500류만)
    if (!result.ok) {
      const errorResult = result as ErrorResult<RelationTypeServiceError, unknown>;
      if (errorResult.status >= 500) {
        logger.error("[relation-types/list] fetch failed", errorResult.error);
      }
    }

    // 6. 응답
    return respond(c, result);
  });
};
