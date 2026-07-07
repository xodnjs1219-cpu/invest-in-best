import type { MiddlewareHandler } from "hono";

/**
 * 모든 라우트 핸들러를 감싸 예외를 500 JSON 응답으로 변환한다 (hono-backend-guide.md 컨벤션).
 */
export const errorBoundary = (): MiddlewareHandler => {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
    }
  };
};
