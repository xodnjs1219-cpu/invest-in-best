import type { MiddlewareHandler } from "hono";
import { getLogger, getSupabaseAuth, type AppEnv, type AuthUser } from "@/backend/hono/context";

/**
 * 요청 쿠키 세션에서 사용자를 조회해 컨텍스트에 주입한다(UC-009 plan 모듈 A3, BR-6 "인증 선택적").
 * withSupabaseAuth 이후에 등록되어야 한다(supabaseAuth 클라이언트 의존).
 * 세션 해석 실패(오류 응답·예외 모두)는 요청을 중단하지 않고 `user=null`로 계속 진행한다
 * (공식 체인 무인증 열람 보장 — 로그인 필요 여부는 각 feature service가 판단).
 */
export const withOptionalAuth = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const supabaseAuth = getSupabaseAuth(c);
    let user: AuthUser | null = null;

    try {
      const { data, error } = await supabaseAuth.auth.getUser();
      if (!error && data.user) {
        user = { id: data.user.id };
      }
      if (error) {
        getLogger(c).debug("[withOptionalAuth] session resolution failed, continuing as guest", {
          message: error.message,
        });
      }
    } catch (err) {
      getLogger(c).debug("[withOptionalAuth] session lookup threw, continuing as guest", {
        message: err instanceof Error ? err.message : "unknown error",
      });
    }

    c.set("user", user);
    await next();
  };
};
