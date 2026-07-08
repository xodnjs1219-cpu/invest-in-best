import type { MiddlewareHandler } from "hono";
import { getAppConfig } from "@/backend/config";
import type { AppEnv, AppLogger } from "@/backend/hono/context";

const createConsoleLogger = (): AppLogger => ({
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
});

/**
 * config(환경변수 파싱 결과 + 요청 origin)와 logger를 컨텍스트에 주입한다.
 * origin은 서비스 계층의 `emailRedirectTo` 조립에 사용된다.
 */
export const withAppContext = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const appConfig = getAppConfig();
    const origin = new URL(c.req.url).origin;

    c.set("config", { ...appConfig, origin });
    c.set("logger", createConsoleLogger());

    await next();
  };
};
