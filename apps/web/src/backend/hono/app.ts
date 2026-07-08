import { Hono } from "hono";
import { basePath } from "@/backend/config";
import type { AppEnv } from "@/backend/hono/context";
import { withAppContext } from "@/backend/middleware/context";
import { errorBoundary } from "@/backend/middleware/error";
import { withOptionalAuth } from "@/backend/middleware/optional-auth";
import { withSupabase } from "@/backend/middleware/supabase";
import { withSupabaseAuth } from "@/backend/middleware/supabase-auth";
import { registerAccountRoutes } from "@/features/account/backend/route";
import { registerAdminBatchRoutes } from "@/features/admin-batches/backend/route";
import { registerAdminLlmProposalRoutes } from "@/features/admin-llm-proposals/backend/route";
import { registerAdminRelationTypeRoutes } from "@/features/admin-relation-types/backend/route";
import { registerAdminValuechainRoutes } from "@/features/admin-valuechains/backend/route";
import { registerAuthRoutes } from "@/features/auth/backend/route";
import { registerCompaniesRoutes } from "@/features/companies/backend/route";
import { registerExampleRoutes } from "@/features/example/backend/route";
import { registerRelationTypeRoutes } from "@/features/relation-types/backend/route";
import { registerSecuritiesRoutes } from "@/features/securities/backend/route";
import { registerValuechainsRoutes } from "@/features/valuechains/backend/route";

let singletonApp: Hono<AppEnv> | null = null;

/**
 * Hono 싱글턴 앱 — 미들웨어 체인(errorBoundary → withAppContext → withSupabase →
 * withSupabaseAuth → withOptionalAuth) 후 기능 라우터를 등록한다 (hono-backend-guide 컨벤션).
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
  app.use("*", withSupabaseAuth());
  app.use("*", withOptionalAuth());

  registerExampleRoutes(app);
  registerAuthRoutes(app);
  registerSecuritiesRoutes(app);
  registerRelationTypeRoutes(app);
  registerValuechainsRoutes(app);
  registerCompaniesRoutes(app);
  registerAdminLlmProposalRoutes(app);
  registerAdminBatchRoutes(app);
  registerAdminRelationTypeRoutes(app);
  registerAdminValuechainRoutes(app);
  registerAccountRoutes(app);

  singletonApp = app;

  return app;
};
