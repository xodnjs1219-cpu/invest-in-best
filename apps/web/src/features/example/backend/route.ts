import type { Hono } from "hono";
import type { AppEnv } from "@/backend/hono/context";
import { respond, success } from "@/backend/http/response";

/**
 * 환경 구축 검증용 최소 예시 라우트.
 * 실제 기능 feature 모듈은 schema.ts/repository.ts/service.ts/error.ts를 갖추되(techstack.md §4),
 * 이 예시는 Hono 앱 배선이 동작함을 확인하는 용도로 최소화했다.
 */
export const registerExampleRoutes = (app: Hono<AppEnv>) => {
  app.get("/example/health", (c) => {
    return respond(c, success({ status: "ok" as const }));
  });
};
