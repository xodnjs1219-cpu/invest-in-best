/**
 * 워커 전용 Supabase 클라이언트 팩토리 (docs/usecases/026/plan.md 모듈 3).
 * 웹(apps/web/src/lib/supabase/*)과 프로세스가 다르므로 절대 공유하지 않는다.
 * service-role 키로 생성하며 세션 유지/토큰 갱신을 끈다(배치 프로세스에 불필요).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WORKER_HTTP_TIMEOUT_MS } from "@iib/domain";
import type { WorkerConfig } from "./config";

type FetchLike = typeof fetch;

/** 요청 단위 타임아웃 fetch 래퍼 — 대량 UPSERT를 고려한 워커 전용 타임아웃 적용. */
export function createTimeoutFetch(timeoutMs: number, baseFetch: FetchLike = fetch): FetchLike {
  return async (input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    const outerSignal = init?.signal;
    if (outerSignal) {
      if (outerSignal.aborted) controller.abort(outerSignal.reason);
      else outerSignal.addEventListener("abort", () => controller.abort(outerSignal.reason));
    }
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

/** 워커 클라이언트 옵션 — persistSession/autoRefreshToken 비활성 + 타임아웃 fetch 주입. */
export function buildWorkerClientOptions(fetchImpl: FetchLike): {
  auth: { persistSession: false; autoRefreshToken: false };
  global: { fetch: FetchLike };
} {
  return {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchImpl },
  };
}

let cachedClient: SupabaseClient | null = null;

/** 프로세스 수명 동안 싱글턴 재사용 — 잡마다 재생성 금지. */
export function createWorkerSupabase(config: WorkerConfig): SupabaseClient {
  if (cachedClient === null) {
    cachedClient = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
      buildWorkerClientOptions(createTimeoutFetch(WORKER_HTTP_TIMEOUT_MS)),
    );
  }
  return cachedClient;
}
