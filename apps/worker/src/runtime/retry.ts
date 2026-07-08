/**
 * 지수 백오프 재시도 유틸리티 (docs/usecases/026/plan.md 모듈 5, techstack §8).
 * - 지수 백오프(base×2^n) + full jitter
 * - shouldRetry 판정 주입: false면 즉시 중단 (예: stock-not-found는 재시도 무의미 — spec 6.4)
 * - 오류 객체가 retryAfterMs를 노출하면 백오프 대신 그 값만큼 대기 (429 Retry-After 존중 — E3)
 */
import { BATCH_MAX_RETRY, BATCH_RETRY_BASE_DELAY_MS } from "@iib/domain";

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/** 오류 객체에서 Retry-After 기반 대기 시간(ms)을 추출한다. 없으면 null. */
export function extractRetryAfterMs(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "retryAfterMs" in error &&
    typeof (error as { retryAfterMs: unknown }).retryAfterMs === "number"
  ) {
    return (error as { retryAfterMs: number }).retryAfterMs;
  }
  return null;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = BATCH_MAX_RETRY,
    baseDelayMs = BATCH_RETRY_BASE_DELAY_MS,
    shouldRetry,
    onRetry,
    sleep = defaultSleep,
    random = Math.random,
  } = options;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries || (shouldRetry !== undefined && !shouldRetry(error))) {
        throw error;
      }
      onRetry?.(attempt, error);
      const retryAfterMs = extractRetryAfterMs(error);
      const delayMs =
        retryAfterMs !== null
          ? retryAfterMs
          : Math.max(1, Math.ceil(random() * baseDelayMs * 2 ** (attempt - 1)));
      await sleep(delayMs);
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
