import { Hono } from "hono";
import { basePath } from "@/backend/config";
import { errorBoundary } from "@/backend/middleware/error";
import { registerExampleRoutes } from "@/features/example/backend/route";

let singletonApp: Hono | null = null;

export const createHonoApp = () => {
  if (singletonApp) {
    return singletonApp;
  }

  const app = new Hono().basePath(basePath);

  app.use("*", errorBoundary());

  registerExampleRoutes(app);

  singletonApp = app;

  return app;
};
