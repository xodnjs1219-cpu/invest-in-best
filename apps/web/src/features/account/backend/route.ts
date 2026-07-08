import type { Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getLogger, getSupabase, getUser, type AppEnv } from "@/backend/hono/context";
import { accountErrorCodes, type AccountServiceError } from "@/features/account/backend/error";
import { countAdmins, deleteAuthUser, findRoleByUserId } from "@/features/account/backend/repository";
import { withdrawAccount, type WithdrawAccountHandlerResult } from "@/features/account/backend/service";

export const registerAccountRoutes = (app: Hono<AppEnv>) => {
  app.delete("/account", async (c) => {
    // 1. 인증 확인 — 본문/파라미터로 대상 사용자를 받지 않는다(BR-7, userId는 세션에서만).
    const user = getUser(c);
    if (!user) {
      return respond(c, failure(401, accountErrorCodes.unauthorized, "로그인이 필요합니다."));
    }

    // 2. 의존성 획득
    const supabase = getSupabase(c);
    const logger = getLogger(c);

    // 3. 서비스 호출
    const result: WithdrawAccountHandlerResult = await withdrawAccount(
      supabase,
      { findRoleByUserId, countAdmins, deleteAuthUser },
      user.id,
    );

    // 4. 로깅 (409는 정상 사용자 흐름 — warn, 500 계열은 error)
    if (!result.ok) {
      const errorResult = result as ErrorResult<AccountServiceError, unknown>;
      if (errorResult.error.code === accountErrorCodes.soleAdminBlocked) {
        logger.warn("[account/withdraw] blocked: sole admin", { userId: user.id });
      } else {
        logger.error("[account/withdraw] withdrawal failed", errorResult.error);
      }
    }

    // 5. 응답
    return respond(c, result);
  });
};
