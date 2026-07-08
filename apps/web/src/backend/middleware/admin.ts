import type { MiddlewareHandler } from "hono";
import { failure, respond } from "@/backend/http/response";
import { getSupabase, getSupabaseAuth, type AppEnv } from "@/backend/hono/context";

const PROFILES_TABLE = "profiles";

/**
 * Admin API 공통 에러 코드(spec §6.2 공통 에러) — UC-021/023/024 어드민 API가 재사용한다.
 */
export const adminAuthErrorCodes = {
  unauthorized: "UNAUTHORIZED",
  adminOnly: "ADMIN_ONLY",
} as const;

export type AdminAuthErrorCode = (typeof adminAuthErrorCodes)[keyof typeof adminAuthErrorCodes];

/**
 * `/admin/*` API 라우트 그룹 전용 인가 미들웨어(BR-10 — RLS 비활성 정책 하에서 인가의 유일한 관문).
 *
 * 1. 요청 쿠키 세션(`withSupabaseAuth`가 주입한 `supabaseAuth`)에서 사용자를 조회한다.
 *    실패/부재 → 401 `UNAUTHORIZED`.
 * 2. service-role 클라이언트(`withSupabase`가 주입한 `supabase`)로 `profiles.role`을 조회한다.
 *    조회 오류(DB 장애 등) → 500 fail-closed(관대한 통과 금지). 행 없음/`role !== 'admin'` → 403 `ADMIN_ONLY`.
 * 3. 통과 시 `adminUser`를 컨텍스트에 주입하고 다음 핸들러로 진행한다.
 *
 * 클라이언트가 보내는 헤더/바디의 role 정보는 일절 신뢰하지 않는다(E12 — 우회 방지).
 * `withSupabaseAuth`·`withSupabase`가 이 미들웨어보다 먼저 등록되어 있어야 한다.
 */
export const withAdminAuth = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const supabaseAuth = getSupabaseAuth(c);

    let userId: string;
    let userEmail: string | null;
    try {
      const { data, error } = await supabaseAuth.auth.getUser();
      if (error || !data.user) {
        return respond(c, failure(401, adminAuthErrorCodes.unauthorized, "로그인이 필요합니다."));
      }
      userId = data.user.id;
      userEmail = data.user.email ?? null;
    } catch {
      return respond(c, failure(401, adminAuthErrorCodes.unauthorized, "로그인이 필요합니다."));
    }

    const supabase = getSupabase(c);
    const { data: profile, error: profileError } = await supabase
      .from(PROFILES_TABLE)
      .select("role")
      .eq("id", userId)
      .maybeSingle<{ role: string }>();

    if (profileError) {
      return respond(
        c,
        failure(500, "ADMIN_AUTH_PROFILE_LOOKUP_FAILED", "관리자 권한 확인 중 오류가 발생했습니다."),
      );
    }

    if (!profile || profile.role !== "admin") {
      return respond(c, failure(403, adminAuthErrorCodes.adminOnly, "관리자 권한이 필요합니다."));
    }

    c.set("adminUser", { id: userId, email: userEmail });
    await next();
  };
};
