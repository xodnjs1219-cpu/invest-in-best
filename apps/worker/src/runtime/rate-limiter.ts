/**
 * 토큰버킷 레이트리미터 (docs/usecases/026/plan.md 모듈 4).
 * API 그룹별 독립 버킷 — 용량=tps, 초당 tps개 재충전. 외부 라이브러리 미사용 (techstack §2).
 * 응답 헤더(X-RateLimit-*) 피드백으로 동적 감속/용량 갱신 (BR-8: TPS 하드코딩 금지).
 */

export interface RateLimiterClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface RateLimiterFeedback {
  limit?: number;
  remaining?: number;
  reset?: number;
}

export interface RateLimiter {
  acquire(group: string): Promise<void>;
  feedback(group: string, info: RateLimiterFeedback): void;
}

interface Bucket {
  capacity: number;
  tokens: number;
  refillPerSec: number;
  lastRefillMs: number;
  penaltyUntilMs: number;
}

const MS_PER_SECOND = 1_000;
/** remaining이 이 값 이하로 내려가면 reset 초 동안 선제 감속한다. */
const REMAINING_SLOWDOWN_THRESHOLD = 2;

const defaultClock: RateLimiterClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export function createRateLimiter(options: {
  groups: Record<string, { tps: number }>;
  clock?: RateLimiterClock;
}): RateLimiter {
  const clock = options.clock ?? defaultClock;
  const buckets = new Map<string, Bucket>();
  for (const [group, { tps }] of Object.entries(options.groups)) {
    buckets.set(group, {
      capacity: tps,
      tokens: tps,
      refillPerSec: tps,
      lastRefillMs: clock.now(),
      penaltyUntilMs: 0,
    });
  }

  function refill(bucket: Bucket, nowMs: number): void {
    const elapsedMs = Math.max(0, nowMs - bucket.lastRefillMs);
    bucket.tokens = Math.min(
      bucket.capacity,
      bucket.tokens + (elapsedMs / MS_PER_SECOND) * bucket.refillPerSec,
    );
    bucket.lastRefillMs = nowMs;
  }

  return {
    async acquire(group: string): Promise<void> {
      const bucket = buckets.get(group);
      if (!bucket) return; // 미정의 그룹은 즉시 통과(안전 기본값)

      for (;;) {
        const nowMs = clock.now();
        if (nowMs < bucket.penaltyUntilMs) {
          await clock.sleep(bucket.penaltyUntilMs - nowMs);
          continue;
        }
        refill(bucket, nowMs);
        if (bucket.tokens >= 1) {
          bucket.tokens -= 1;
          return;
        }
        const deficit = 1 - bucket.tokens;
        const waitMs = Math.ceil((deficit / bucket.refillPerSec) * MS_PER_SECOND);
        await clock.sleep(waitMs);
      }
    },

    feedback(group: string, info: RateLimiterFeedback): void {
      const bucket = buckets.get(group);
      if (!bucket) return;

      if (info.limit !== undefined && info.limit > 0 && info.limit !== bucket.capacity) {
        bucket.capacity = info.limit;
        bucket.refillPerSec = info.limit;
        bucket.tokens = Math.min(bucket.tokens, bucket.capacity);
      }
      if (
        info.remaining !== undefined &&
        info.remaining <= REMAINING_SLOWDOWN_THRESHOLD &&
        info.reset !== undefined &&
        info.reset > 0
      ) {
        bucket.penaltyUntilMs = Math.max(
          bucket.penaltyUntilMs,
          clock.now() + info.reset * MS_PER_SECOND,
        );
      }
    },
  };
}
