import type { Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import { getConfig, getLogger, getSupabase, type AppEnv } from "@/backend/hono/context";
import { authErrorCodes, type AuthServiceError } from "@/features/auth/backend/error";
import {
  insertTermsAgreements,
  signUpWithEmail,
  updateProfileRole,
} from "@/features/auth/backend/repository";
import { SignupRequestSchema } from "@/features/auth/backend/schema";
import { signUp, type SignupHandlerResult } from "@/features/auth/backend/service";

const WARN_LEVEL_CODES: AuthServiceError[] = [
  authErrorCodes.invalidRequest,
  authErrorCodes.passwordPolicyViolation,
  authErrorCodes.passwordConfirmMismatch,
  authErrorCodes.termsNotAgreed,
  authErrorCodes.rateLimited,
];

export const registerAuthRoutes = (app: Hono<AppEnv>) => {
  app.post("/auth/signup", async (c) => {
    // 1. body 파싱 + 요청 스키마 검증 (E5)
    const body = await c.req.json().catch(() => null);
    const parsed = SignupRequestSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        c,
        failure(
          400,
          authErrorCodes.invalidRequest,
          "요청 형식이 올바르지 않습니다.",
          parsed.error.format(),
        ),
      );
    }

    // 2. 의존성 획득
    const supabase = getSupabase(c);
    const logger = getLogger(c);
    const config = getConfig(c);

    // 3. 서비스 호출
    const result: SignupHandlerResult = await signUp(
      supabase,
      { signUpWithEmail, insertTermsAgreements, updateProfileRole },
      config,
      parsed.data,
    );

    // 4. 로깅 (응답 body에는 Supabase 원문 오류를 노출하지 않는다 — details는 로그 전용)
    if (!result.ok) {
      const errorResult = result as ErrorResult<AuthServiceError, unknown>;
      const isWarnLevel = WARN_LEVEL_CODES.includes(errorResult.error.code);
      if (isWarnLevel) {
        logger.warn("[auth/signup] request rejected", errorResult.error);
      } else {
        logger.error("[auth/signup] signup failed", errorResult.error);
      }
    }
    if (result.meta?.adminPromotionFailed) {
      logger.warn("[auth/signup] admin promotion failed for signup", { email: parsed.data.email });
    }

    // 5. 응답
    return respond(c, result);
  });
};
