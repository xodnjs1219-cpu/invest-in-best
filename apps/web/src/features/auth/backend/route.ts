import type { Hono } from "hono";
import { failure, respond, type ErrorResult } from "@/backend/http/response";
import {
  getConfig,
  getLogger,
  getSupabase,
  getSupabaseAuth,
  type AppEnv,
} from "@/backend/hono/context";
import { authErrorCodes, type AuthServiceError } from "@/features/auth/backend/error";
import { oauthSignOut, exchangeCodeForSession, createAuthorizationUrl } from "@/features/auth/backend/oauth-gateway";
import {
  discardSession,
  findProfileById,
  getRecoverySessionUser,
  insertTermsAgreements,
  listTermsAgreementDocTypes,
  sendPasswordResetEmail,
  signInWithPassword,
  signOutCurrentSession,
  signUpWithEmail,
  updatePasswordAndRevokeAllSessions,
  updateProfileRole,
  verifyRecoveryToken,
} from "@/features/auth/backend/repository";
import {
  ConfirmPasswordResetRequestSchema,
  LoginRequestSchema,
  OAuthCallbackRequestSchema,
  OAuthStartRequestSchema,
  PasswordResetRequestRequestSchema,
  SignupRequestSchema,
  VerifyResetTokenRequestSchema,
} from "@/features/auth/backend/schema";
import {
  completeGoogleOAuth,
  confirmPasswordReset,
  loginWithEmail,
  logout,
  requestPasswordReset,
  signUp,
  startGoogleOAuth,
  verifyResetToken,
  type ConfirmPasswordResetHandlerResult,
  type LoginHandlerResult,
  type LogoutHandlerResult,
  type OAuthCompleteHandlerResult,
  type OAuthStartHandlerResult,
  type PasswordResetRequestHandlerResult,
  type SignupHandlerResult,
  type VerifyResetTokenHandlerResult,
} from "@/features/auth/backend/service";

const WARN_LEVEL_CODES: AuthServiceError[] = [
  authErrorCodes.invalidRequest,
  authErrorCodes.passwordPolicyViolation,
  authErrorCodes.passwordConfirmMismatch,
  authErrorCodes.termsNotAgreed,
  authErrorCodes.rateLimited,
  authErrorCodes.invalidCredentials,
  authErrorCodes.emailNotConfirmed,
  authErrorCodes.invalidRedirectPath,
  authErrorCodes.unsupportedProvider,
  authErrorCodes.oauthExchangeFailed,
  authErrorCodes.oauthEmailUnverified,
  authErrorCodes.passwordResetInvalidEmail,
  authErrorCodes.passwordResetRateLimited,
  authErrorCodes.passwordResetTokenInvalid,
  authErrorCodes.passwordResetPolicyViolation,
  authErrorCodes.passwordResetSessionInvalid,
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

  app.post("/auth/login", async (c) => {
    // 1. body 파싱 + 요청 스키마 검증 (E5)
    const body = await c.req.json().catch(() => null);
    const parsed = LoginRequestSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        c,
        failure(400, authErrorCodes.invalidRequest, "요청 형식이 올바르지 않습니다.", parsed.error.format()),
      );
    }

    // 2. 의존성 획득 (service-role 클라이언트 + 쿠키 바인딩 인증 클라이언트)
    const supabase = getSupabase(c);
    const supabaseAuth = getSupabaseAuth(c);
    const logger = getLogger(c);

    // 3. 서비스 호출
    const result: LoginHandlerResult = await loginWithEmail(
      supabase,
      supabaseAuth,
      { signInWithPassword, findProfileById, discardSession },
      parsed.data,
    );

    // 4. 로깅 (응답 body에는 Supabase 원문 오류를 노출하지 않는다 — details는 로그 전용)
    if (!result.ok) {
      const errorResult = result as ErrorResult<AuthServiceError, unknown>;
      const isWarnLevel = WARN_LEVEL_CODES.includes(errorResult.error.code);
      if (isWarnLevel) {
        logger.warn("[auth/login] request rejected", errorResult.error);
      } else {
        logger.error("[auth/login] login failed", errorResult.error);
      }
    }

    // 5. 응답 (세션 토큰은 바디에 없음 — supabaseAuth 쿠키 어댑터가 Set-Cookie로 기록)
    return respond(c, result);
  });

  app.post("/auth/oauth/:provider/start", async (c) => {
    const provider = c.req.param("provider");
    const body = await c.req.json().catch(() => ({}));
    const parsed = OAuthStartRequestSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        c,
        failure(400, authErrorCodes.invalidRequest, "요청 형식이 올바르지 않습니다.", parsed.error.format()),
      );
    }

    const supabaseAuth = getSupabaseAuth(c);
    const config = getConfig(c);
    const logger = getLogger(c);

    const result: OAuthStartHandlerResult = await startGoogleOAuth(
      supabaseAuth,
      { createAuthorizationUrl },
      config,
      { provider, redirectPath: parsed.data.redirectPath },
    );

    if (!result.ok) {
      const errorResult = result as ErrorResult<AuthServiceError, unknown>;
      const isWarnLevel = WARN_LEVEL_CODES.includes(errorResult.error.code);
      if (isWarnLevel) {
        logger.warn("[auth/oauth/start] request rejected", errorResult.error);
      } else {
        logger.error("[auth/oauth/start] start failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  app.post("/auth/oauth/:provider/callback", async (c) => {
    const provider = c.req.param("provider");
    const body = await c.req.json().catch(() => null);
    const parsed = OAuthCallbackRequestSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        c,
        failure(400, authErrorCodes.invalidRequest, "요청 형식이 올바르지 않습니다.", parsed.error.format()),
      );
    }

    const supabase = getSupabase(c);
    const supabaseAuth = getSupabaseAuth(c);
    const config = getConfig(c);
    const logger = getLogger(c);

    const result: OAuthCompleteHandlerResult = await completeGoogleOAuth(
      supabase,
      supabaseAuth,
      {
        exchangeCodeForSession,
        oauthSignOut,
        findProfileById,
        updateProfileRole,
        listTermsAgreementDocTypes,
        insertTermsAgreements,
      },
      config,
      { provider, code: parsed.data.code, redirectPath: parsed.data.redirectPath },
      () => new Date(),
    );

    if (!result.ok) {
      const errorResult = result as ErrorResult<AuthServiceError, unknown>;
      const isWarnLevel = WARN_LEVEL_CODES.includes(errorResult.error.code);
      if (isWarnLevel) {
        logger.warn("[auth/oauth/callback] request rejected", errorResult.error);
      } else {
        logger.error("[auth/oauth/callback] callback failed", errorResult.error);
      }
    }
    if (result.meta?.termsSaveFailed) {
      logger.warn("[auth/oauth/callback] terms agreement save failed", { provider });
    }

    return respond(c, result);
  });

  app.post("/auth/password-reset/request", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PasswordResetRequestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        c,
        failure(
          400,
          authErrorCodes.passwordResetInvalidEmail,
          "올바른 이메일 형식이 아닙니다.",
          parsed.error.format(),
        ),
      );
    }

    const supabaseAuth = getSupabaseAuth(c);
    const config = getConfig(c);
    const logger = getLogger(c);

    const result: PasswordResetRequestHandlerResult = await requestPasswordReset(
      supabaseAuth,
      { sendPasswordResetEmail },
      parsed.data.email,
      config.origin,
    );

    if (!result.ok) {
      const errorResult = result as ErrorResult<AuthServiceError, unknown>;
      const isWarnLevel = WARN_LEVEL_CODES.includes(errorResult.error.code);
      if (isWarnLevel) {
        logger.warn("[auth/password-reset/request] request rejected", errorResult.error);
      } else {
        logger.error("[auth/password-reset/request] send failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  app.post("/auth/password-reset/verify", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = VerifyResetTokenRequestSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        c,
        failure(400, authErrorCodes.passwordResetTokenInvalid, "링크가 유효하지 않습니다. 재설정을 다시 요청해 주세요."),
      );
    }

    const supabaseAuth = getSupabaseAuth(c);
    const logger = getLogger(c);

    const result: VerifyResetTokenHandlerResult = await verifyResetToken(
      supabaseAuth,
      { verifyRecoveryToken },
      parsed.data.tokenHash,
    );

    if (!result.ok) {
      const errorResult = result as ErrorResult<AuthServiceError, unknown>;
      const isWarnLevel = WARN_LEVEL_CODES.includes(errorResult.error.code);
      if (isWarnLevel) {
        logger.warn("[auth/password-reset/verify] request rejected", errorResult.error);
      } else {
        logger.error("[auth/password-reset/verify] verify failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  app.post("/auth/password-reset/confirm", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = ConfirmPasswordResetRequestSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        c,
        failure(
          400,
          authErrorCodes.passwordResetPolicyViolation,
          "비밀번호가 정책(8자 이상, 영문+숫자 포함)을 충족하지 않습니다.",
        ),
      );
    }

    const supabaseAuth = getSupabaseAuth(c);
    const logger = getLogger(c);

    const result: ConfirmPasswordResetHandlerResult = await confirmPasswordReset(
      supabaseAuth,
      { getRecoverySessionUser, updatePasswordAndRevokeAllSessions },
      parsed.data.newPassword,
    );

    if (!result.ok) {
      const errorResult = result as ErrorResult<AuthServiceError, unknown>;
      const isWarnLevel = WARN_LEVEL_CODES.includes(errorResult.error.code);
      if (isWarnLevel) {
        logger.warn("[auth/password-reset/confirm] request rejected", errorResult.error);
      } else {
        logger.error("[auth/password-reset/confirm] update failed", errorResult.error);
      }
    }

    return respond(c, result);
  });

  // 본문 검증 없음(요청 본문 없는 계약) — 인증 가드도 두지 않는다.
  // 비로그인 요청도 멱등 성공(200)이어야 하므로 401 차단 미들웨어를 적용하지 않는 것이 계약이다.
  app.post("/auth/logout", async (c) => {
    const supabaseAuth = getSupabaseAuth(c);
    const logger = getLogger(c);

    const result: LogoutHandlerResult = await logout(supabaseAuth, { signOutCurrentSession });

    if (!result.ok) {
      logger.error("[auth/logout] logout failed", (result as ErrorResult<AuthServiceError, unknown>).error);
    }

    return respond(c, result);
  });
};
