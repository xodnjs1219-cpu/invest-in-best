import type { MiddlewareHandler } from "hono";
import { getConfig, type AppEnv } from "@/backend/hono/context";
import { createServiceClient } from "@/lib/supabase/service-client";

/**
 * service-role Supabase 클라이언트를 생성해 컨텍스트에 주입한다.
 * withAppContext 이후에 등록되어야 한다 (config 의존).
 */
export const withSupabase = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const config = getConfig(c);

    c.set(
      "supabase",
      createServiceClient({
        supabaseUrl: config.supabaseUrl,
        supabaseServiceRoleKey: config.supabaseServiceRoleKey,
      }),
    );

    await next();
  };
};
