/**
 * 정기 잡 경합 가드 (docs/usecases/031/plan.md 모듈 14, H-7).
 * 정기 수집 잡(BACKFILL_CONFLICT_JOB_TYPES) `running` 감지 시 백필이 일시 정지(폴링 대기)한다 —
 * "정기 잡 우선, 백필이 양보" 정책. 대기 중에도 하트비트(onWait)를 호출해 고아 오판(E17)을 방지한다.
 */
import { BACKFILL_CONFLICT_JOB_TYPES, BACKFILL_REGULAR_JOB_POLL_MS } from "@iib/domain";
import type { RepoResult } from "../../repositories/result";
import type { RunningRun } from "../../repositories/batch.repository";

export interface RegularJobGuardClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const defaultClock: RegularJobGuardClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface RegularJobGuardBatchRepo {
  findRunningRun(jobType: string): Promise<RepoResult<RunningRun | null>>;
}

export interface RegularJobGuard {
  /** 경합 잡이 모두 idle이 될 때까지 대기(폴링). backfill_all 자신은 검사 대상에서 제외된다. */
  waitUntilIdle(runId: string): Promise<void>;
}

export interface CreateRegularJobGuardOptions {
  batchRepo: RegularJobGuardBatchRepo;
  clock?: RegularJobGuardClock;
  /** 대기 사이클마다 호출되는 하트비트 콜백(runId 전달 — updateRunProgress 등으로 연결). */
  onWait?: (runId: string) => void | Promise<void>;
}

async function anyConflictRunning(batchRepo: RegularJobGuardBatchRepo): Promise<boolean> {
  for (const jobType of BACKFILL_CONFLICT_JOB_TYPES) {
    const result = await batchRepo.findRunningRun(jobType);
    if (result.ok && result.data !== null) {
      return true;
    }
  }
  return false;
}

export function createRegularJobGuard(options: CreateRegularJobGuardOptions): RegularJobGuard {
  const { batchRepo, onWait } = options;
  const clock = options.clock ?? defaultClock;

  return {
    async waitUntilIdle(runId: string): Promise<void> {
      for (;;) {
        const conflictRunning = await anyConflictRunning(batchRepo);
        if (!conflictRunning) return;

        await onWait?.(runId);
        await clock.sleep(BACKFILL_REGULAR_JOB_POLL_MS);
      }
    },
  };
}
