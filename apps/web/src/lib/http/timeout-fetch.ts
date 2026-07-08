import { HTTP_TIMEOUT_MS } from "@iib/domain";

export type BaseFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type TimeoutFetchOptions = {
  timeoutMs?: number;
  /** 테스트 주입용. 기본값은 전역 fetch. */
  baseFetch?: BaseFetch;
};

/**
 * 공통 타임아웃 fetch 래퍼 — Supabase 클라이언트 팩토리와 FE API 클라이언트에 일괄 주입한다.
 * 지정 시간 초과 시 `TimeoutError`로 abort 하고, 호출자 signal의 abort도 함께 전파한다.
 */
export const createTimeoutFetch = (options?: TimeoutFetchOptions): BaseFetch => {
  const timeoutMs = options?.timeoutMs ?? HTTP_TIMEOUT_MS;
  const baseFetch = options?.baseFetch ?? ((input, init) => fetch(input, init));

  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError"));
    }, timeoutMs);
    const callerSignal = init?.signal ?? undefined;
    const propagateAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) {
      propagateAbort();
    }
    callerSignal?.addEventListener("abort", propagateAbort, { once: true });

    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", propagateAbort);
    }
  };
};
