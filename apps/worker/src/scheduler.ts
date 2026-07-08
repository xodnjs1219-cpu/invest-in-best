/**
 * 워커 스케줄러 진입점 (docs/usecases/026/plan.md 모듈 8).
 * 기동 시 설정 로드(조기 실패) → Supabase 클라이언트 생성 → 잡 의존성 조립 → cron 등록.
 * 이후 유스케이스(027~030)는 registerSchedules에 cron.schedule 행만 추가한다(1 잡 = 1 파일 원칙 유지).
 */
import cron from "node-cron";
import { COLLECT_QUOTES_CRON } from "@iib/domain";
import { getWorkerConfig } from "./runtime/config";
import { createWorkerSupabase } from "./runtime/supabase";
import { createJobLock, type JobLock } from "./runtime/job-lock";
import { createBatchLogger } from "./runtime/batch-log";
import { createRateLimiter } from "./runtime/rate-limiter";
import { createTossInvestClient } from "./adapters/tossinvest/client";
import { createCollectQuotesJob } from "./jobs/collect-quotes.job";
import { findByMarketDate } from "./repositories/market-calendar.repository";
import { findCollectTargets } from "./repositories/securities.repository";
import {
  deleteExpiredTicks,
  findUnconfirmedDaily,
  upsertConfirmedDaily,
  upsertProvisionalDaily,
  upsertTicks,
} from "./repositories/quotes.repository";

const JOB_TYPE_COLLECT_QUOTES = "collect_quotes";

export interface CollectQuotesJobPort {
  run(now?: Date): Promise<void>;
}

export interface SchedulerDeps {
  jobLock: JobLock;
  collectQuotesJob: CollectQuotesJobPort;
  cronSchedule: (expression: string, handler: () => void | Promise<void>) => unknown;
}

/**
 * cron 등록 로직만 분리한 순수 함수 — 테스트는 이 함수를 직접 호출해 cronSchedule/job/lock을 mock 검증한다.
 * handler는 잡의 어떤 예외도 프로세스로 전파하지 않는다(최후 방어 try/catch).
 */
export function registerSchedules(deps: SchedulerDeps): void {
  deps.cronSchedule(COLLECT_QUOTES_CRON, async () => {
    if (!deps.jobLock.tryAcquire(JOB_TYPE_COLLECT_QUOTES)) {
      console.warn(`[scheduler] ${JOB_TYPE_COLLECT_QUOTES} already running — skip this tick`);
      return;
    }
    try {
      await deps.collectQuotesJob.run();
    } catch (error) {
      console.error(`[scheduler] ${JOB_TYPE_COLLECT_QUOTES} job crashed unexpectedly:`, error);
    } finally {
      deps.jobLock.release(JOB_TYPE_COLLECT_QUOTES);
    }
  });
}

/** 실 프로세스 기동 — 의존성을 전부 조립해 registerSchedules에 주입한다. */
export function startScheduler(): void {
  const config = getWorkerConfig(); // 조기 실패: 필수 env 누락 시 여기서 프로세스 기동 중단
  const supabase = createWorkerSupabase(config);
  const jobLock = createJobLock();
  const batchLog = createBatchLogger(supabase);
  const rateLimiter = createRateLimiter({
    groups: { AUTH: { tps: 5 }, MARKET_DATA: { tps: 10 }, MARKET_DATA_CHART: { tps: 5 } },
  });
  const toss = createTossInvestClient({ config, rateLimiter });

  const collectQuotesJob = createCollectQuotesJob({
    toss,
    batchLog,
    repos: {
      findCollectTargets: (markets) => findCollectTargets(supabase, markets),
      findByMarketDate: (market, localDate) => findByMarketDate(supabase, market, localDate),
      upsertTicks: (rows) => upsertTicks(supabase, rows),
      upsertProvisionalDaily: (market, tradeDate, fromUtc, toUtc) =>
        upsertProvisionalDaily(supabase, market, tradeDate, fromUtc, toUtc),
      findUnconfirmedDaily: (market, tradeDate) =>
        findUnconfirmedDaily(supabase, market, tradeDate),
      upsertConfirmedDaily: (rows) => upsertConfirmedDaily(supabase, rows),
      deleteExpiredTicks: (cutoffUtc) => deleteExpiredTicks(supabase, cutoffUtc),
    },
  });

  registerSchedules({
    jobLock,
    collectQuotesJob,
    cronSchedule: (expression, handler) => cron.schedule(expression, handler),
  });

  console.log("[scheduler] worker started");
}

if (process.env.NODE_ENV !== "test") {
  startScheduler();
}
