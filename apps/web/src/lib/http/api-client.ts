import { API_BASE_PATH } from "@/lib/http/constants";
import { createTimeoutFetch } from "@/lib/http/timeout-fetch";

/**
 * 백엔드 `HandlerResult` 오류 형태(`{error:{code,message}}`)를 표현하는 클라이언트 오류.
 * TanStack Query `onError` 등에서 `error.code`/`error.status`로 분기할 수 있다.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const NETWORK_ERROR_CODE = "NETWORK_ERROR";
const NETWORK_ERROR_MESSAGE = "네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.";

const timeoutFetch = createTimeoutFetch();

type ApiSuccessBody<T> = { data: T };
type ApiErrorBody = { error: { code: string; message: string } };

/**
 * FE API 클라이언트 — 베이스 `/api`, JSON 직렬화/파싱, 타임아웃, 세션은 HTTP-only 쿠키
 * (`credentials: 'same-origin'`)로 전달한다. 토큰 헤더는 사용하지 않는다.
 */
export const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const url = `${API_BASE_PATH}${path}`;

  let response: Response;
  try {
    response = await timeoutFetch(url, {
      ...init,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_CODE, 0, NETWORK_ERROR_MESSAGE);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new ApiError(
      errorBody?.error?.code ?? NETWORK_ERROR_CODE,
      response.status,
      errorBody?.error?.message ?? NETWORK_ERROR_MESSAGE,
    );
  }

  // 204 No Content 등 무본문 성공 응답은 body가 null이다(UC-019 삭제) — data 없이 undefined 반환.
  return body === null ? (undefined as T) : (body as ApiSuccessBody<T>).data;
};

/**
 * DELETE 전용 헬퍼 (UC-019 plan 모듈 6) — `204 No Content` 무본문 성공 응답을
 * JSON 파싱 오류 없이 처리한다(`apiFetch`가 이미 `.json().catch(() => null)`로 안전 처리하므로
 * `body`가 없으면 `undefined`를 반환). 실패 시 `ApiError`는 `apiFetch`와 동일하게 전파된다.
 */
export const apiDelete = (path: string): Promise<void> => apiFetch<void>(path, { method: "DELETE" });
