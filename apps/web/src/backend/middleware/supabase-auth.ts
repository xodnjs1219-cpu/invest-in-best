import type { MiddlewareHandler } from "hono";
import { getConfig, type AppEnv } from "@/backend/hono/context";
import { createRouteAuthClient } from "@/lib/supabase/route-client";

/**
 * 요청 쿠키에 바인딩된 anon-key Supabase Auth 클라이언트를 컨텍스트에 주입한다.
 * withAppContext 이후에 등록되어야 한다(config 의존). 매 요청마다 새로 생성한다
 * (세션 확립/폐기 라우트 전용 — 조회 전용 라우트는 `withSupabase`의 service-role 클라이언트를 사용).
 */
export const withSupabaseAuth = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const config = getConfig(c);

    c.set(
      "supabaseAuth",
      createRouteAuthClient(c, {
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
      }),
    );

    await next();
  };
};
