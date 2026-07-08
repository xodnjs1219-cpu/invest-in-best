import { Hono } from "hono";
import { basePath } from "@/backend/config";
import type { AppEnv } from "@/backend/hono/context";
import { withAppContext } from "@/backend/middleware/context";
import { errorBoundary } from "@/backend/middleware/error";
import { withSupabase } from "@/backend/middleware/supabase";
import { registerAuthRoutes } from "@/features/auth/backend/route";
import { registerExampleRoutes } from "@/features/example/backend/route";

let singletonApp: Hono<AppEnv> | null = null;

/**
 * Hono 싱글턴 앱 — 미들웨어 체인(errorBoundary → withAppContext → withSupabase) 후
 * 기능 라우터를 등록한다 (hono-backend-guide 컨벤션).
 */
export const createHonoApp = () => {
  if (singletonApp) {
    return singletonApp;
  }

  const app = new Hono<AppEnv>().basePath(basePath);

  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: "요청한 API 경로를 찾을 수 없습니다." } }, 404),
  );

  app.onError(errorBoundary());
  app.use("*", withAppContext());
  app.use("*", withSupabase());

  registerExampleRoutes(app);
  registerAuthRoutes(app);

  singletonApp = app;

  return app;
};
