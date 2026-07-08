import type { ErrorHandler } from "hono";
import type { AppEnv } from "@/backend/hono/context";

const INTERNAL_ERROR_CODE = "INTERNAL_ERROR" as const;
const INTERNAL_ERROR_MESSAGE = "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * 미처리 예외를 500 통일 JSON으로 변환하는 전역 에러 핸들러.
 * Hono v4의 compose는 핸들러 예외를 미들웨어 try/catch가 아닌 onError로 라우팅하므로
 * `app.onError(errorBoundary())`로 등록한다. 스택은 서버 로그에만 남기고
 * 응답에는 내부 정보를 노출하지 않는다.
 */
export const errorBoundary = (): ErrorHandler<AppEnv> => {
  return (error, c) => {
    console.error("[errorBoundary] Unhandled exception:", error);
    return c.json({ error: { code: INTERNAL_ERROR_CODE, message: INTERNAL_ERROR_MESSAGE } }, 500);
  };
};
