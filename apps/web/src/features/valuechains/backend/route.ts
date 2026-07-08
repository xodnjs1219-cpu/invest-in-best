import type { Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getLogger, getSupabase, getUser, type AppEnv } from "@/backend/hono/context";
import { valuechainsErrorCodes, type ValuechainsServiceError } from "@/features/valuechains/backend/error";
import { createValuechainsViewRepository } from "@/features/valuechains/backend/repository";
import { ChainIdParamSchema } from "@/features/valuechains/backend/schema";
import { getChainView } from "@/features/valuechains/backend/service";

/**
 * valuechains 라우터 (plan 모듈 B5) — `GET /valuechains/:chainId`.
 * HTTP 파싱/검증·의존성 주입·에러 로깅·respond() 위임만 담당한다(비즈니스 로직은 service.ts).
 */
export const registerValuechainsRoutes = (app: Hono<AppEnv>) => {
  app.get("/valuechains/:chainId", async (c) => {
    // 1. Path param 검증 (E12)
    const parsed = ChainIdParamSchema.safeParse({ chainId: c.req.param("chainId") });
    if (!parsed.success) {
      return respond(
        c,
        failure(400, valuechainsErrorCodes.invalidChainId, "잘못된 밸류체인 경로입니다."),
      );
    }

    // 2. 의존성 획득 — 인증은 선택적(BR-6): 세션 있으면 사용자 식별, 없으면 Guest(null)
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const currentUser = getUser(c);
    const repo = createValuechainsViewRepository(supabase);

    // 3. 서비스 호출
    const result = await getChainView(repo, parsed.data.chainId, currentUser?.id ?? null);

    // 4. 에러 로깅 (500류만 — 정합성 예외는 별도 식별 로그, E9 운영 추적)
    if (!result.ok) {
      const errorResult = result as ErrorResult<ValuechainsServiceError, unknown>;
      if (result.status >= 500) {
        if (errorResult.error.code === valuechainsErrorCodes.snapshotMissing) {
          logger.error("[valuechains/get] snapshot missing (data integrity)", {
            chainId: parsed.data.chainId,
          });
        } else {
          logger.error("[valuechains/get] structure load failed", errorResult.error);
        }
      }
    }

    // 5. 응답
    return respond(c, result);
  });
};
