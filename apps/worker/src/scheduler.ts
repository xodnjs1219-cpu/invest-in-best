/**
 * 워커 스케줄러 진입점 (docs/usecases/026/plan.md 모듈 8).
 * 기동 시 설정 로드(조기 실패) → Supabase 클라이언트 생성 → 잡 의존성 조립 → cron 등록.
 * 이후 유스케이스(027~030)는 registerSchedules에 cron.schedule 행만 추가한다(1 잡 = 1 파일 원칙 유지).
 */
import cron from "node-cron";
import {
  BATCH_CRON_TIMEZONE,
  BATCH_TIMEZONE,
  COLLECT_FINANCIALS_CRON,
  COLLECT_FX_MARKET_HOURS_CRON,
  COLLECT_QUOTES_CRON,
} from "@iib/domain";
import { getWorkerConfig } from "./runtime/config";
import { createWorkerSupabase } from "./runtime/supabase";
import { createJobLock, type JobLock } from "./runtime/job-lock";
import { createBatchLogger } from "./runtime/batch-log";
import { createRateLimiter } from "./runtime/rate-limiter";
import { createTossInvestClient } from "./adapters/tossinvest/client";
import { createOpenDartClient } from "./adapters/opendart/client";
import { createSecEdgarClient } from "./adapters/sec-edgar/client";
import { createCollectQuotesJob } from "./jobs/collect-quotes.job";
import { createCollectFinancialsJob } from "./jobs/collect-financials.job";
import { createCollectFxMarketHoursJob } from "./jobs/collect-fx-market-hours.job";
import { findByMarketDate, upsertDays } from "./repositories/market-calendar.repository";
import {
  findAllForFinancials,
  findCollectTargets,
  flagSharesManualOverride,
  updateDartCorpCodes,
} from "./repositories/securities.repository";
import {
  deleteExpiredTicks,
  findUnconfirmedDaily,
  upsertConfirmedDaily,
  upsertProvisionalDaily,
  upsertTicks,
} from "./repositories/quotes.repository";
import { completeCheckpoint, getCheckpoint, upsertCheckpoint } from "./repositories/checkpoints.repository";
import { upsertProfiles, findProfileFreshness } from "./repositories/company-profiles.repository";
import { upsertDisclosures } from "./repositories/disclosures.repository";
import { findExistingPeriodKeys, upsertFinancials } from "./repositories/financials.repository";
import { findLatestBySource, upsertShares } from "./repositories/shares.repository";
import { findLatestRate, upsertRate } from "./repositories/fx.repository";

const JOB_TYPE_COLLECT_QUOTES = "collect_quotes";
const JOB_TYPE_COLLECT_FINANCIALS = "collect_financials";
const JOB_TYPE_COLLECT_FX_MARKET_HOURS = "collect_fx_market_hours";

export interface CollectQuotesJobPort {
  run(now?: Date): Promise<void>;
}

export interface CollectFinancialsJobPort {
  run(now?: Date): Promise<void>;
}

export interface CollectFxMarketHoursJobPort {
  run(now?: Date): Promise<void>;
}

export interface CronScheduleOptions {
  timezone?: string;
}

export interface SchedulerDeps {
  jobLock: JobLock;
  collectQuotesJob: CollectQuotesJobPort;
  collectFinancialsJob?: CollectFinancialsJobPort;
  collectFxMarketHoursJob?: CollectFxMarketHoursJobPort;
  cronSchedule: (
    expression: string,
    handler: () => void | Promise<void>,
    options?: CronScheduleOptions,
  ) => unknown;
}

/**
 * cron 등록 로직만 분리한 순수 함수 — 테스트는 이 함수를 직접 호출해 cronSchedule/job/lock을 mock 검증한다.
 * handler는 잡의 어떤 예외도 프로세스로 전파하지 않는다(최후 방어 try/catch).
 */
export function registerSchedules(deps: SchedulerDeps): void {
  deps.cronSchedule(
    COLLECT_QUOTES_CRON,
    async () => {
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
    },
    undefined,
  );

  if (deps.collectFinancialsJob) {
    const collectFinancialsJob = deps.collectFinancialsJob;
    deps.cronSchedule(
      COLLECT_FINANCIALS_CRON,
      async () => {
        if (!deps.jobLock.tryAcquire(JOB_TYPE_COLLECT_FINANCIALS)) {
          console.warn(`[scheduler] ${JOB_TYPE_COLLECT_FINANCIALS} already running — skip this tick`);
          return;
        }
        try {
          await collectFinancialsJob.run();
        } catch (error) {
          console.error(`[scheduler] ${JOB_TYPE_COLLECT_FINANCIALS} job crashed unexpectedly:`, error);
        } finally {
          deps.jobLock.release(JOB_TYPE_COLLECT_FINANCIALS);
        }
      },
      { timezone: BATCH_TIMEZONE },
    );
  }

  if (deps.collectFxMarketHoursJob) {
    const collectFxMarketHoursJob = deps.collectFxMarketHoursJob;
    deps.cronSchedule(
      COLLECT_FX_MARKET_HOURS_CRON,
      async () => {
        if (!deps.jobLock.tryAcquire(JOB_TYPE_COLLECT_FX_MARKET_HOURS)) {
          console.warn(`[scheduler] ${JOB_TYPE_COLLECT_FX_MARKET_HOURS} already running — skip this tick`);
          return;
        }
        try {
          await collectFxMarketHoursJob.run();
        } catch (error) {
          console.error(`[scheduler] ${JOB_TYPE_COLLECT_FX_MARKET_HOURS} job crashed unexpectedly:`, error);
        } finally {
          deps.jobLock.release(JOB_TYPE_COLLECT_FX_MARKET_HOURS);
        }
      },
      { timezone: BATCH_CRON_TIMEZONE },
    );
  }
}

/** 실 프로세스 기동 — 의존성을 전부 조립해 registerSchedules에 주입한다. */
export function startScheduler(): void {
  const config = getWorkerConfig(); // 조기 실패: 필수 env 누락 시 여기서 프로세스 기동 중단
  const supabase = createWorkerSupabase(config);
  const jobLock = createJobLock();
  const batchLog = createBatchLogger(supabase);
  const rateLimiter = createRateLimiter({
    groups: {
      AUTH: { tps: 5 },
      MARKET_DATA: { tps: 10 },
      MARKET_DATA_CHART: { tps: 5 },
      STOCK: { tps: 5 },
      MARKET_INFO: { tps: 3 },
      OPENDART: { tps: 8 },
      SEC: { tps: 6 },
    },
  });
  const toss = createTossInvestClient({ config, rateLimiter });
  const dart = createOpenDartClient({ config, rateLimiter });
  const sec = createSecEdgarClient({ config, rateLimiter });

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

  const collectFinancialsJob = createCollectFinancialsJob({
    dart,
    sec,
    toss,
    batchLog,
    checkpoints: {
      get: (jobType, key) => getCheckpoint(supabase, jobType, key),
      upsert: (jobType, key, cursor, isCompleted) => upsertCheckpoint(supabase, jobType, key, cursor, isCompleted),
      complete: (jobType, key) => completeCheckpoint(supabase, jobType, key),
    },
    repos: {
      findAllForFinancials: () => findAllForFinancials(supabase),
      updateDartCorpCodes: (rows) => updateDartCorpCodes(supabase, rows),
      flagSharesManualOverride: (securityIds) => flagSharesManualOverride(supabase, securityIds),
      upsertFinancials: (rows) => upsertFinancials(supabase, rows),
      findExistingPeriodKeys: (securityIds, fiscalYear, fiscalQuarter) =>
        findExistingPeriodKeys(supabase, securityIds, fiscalYear, fiscalQuarter),
      upsertDisclosures: (rows) => upsertDisclosures(supabase, rows),
      upsertProfiles: (rows) => upsertProfiles(supabase, rows),
      findProfileFreshness: (securityIds) => findProfileFreshness(supabase, securityIds),
      findLatestBySource: (securityIds, source) => findLatestBySource(supabase, securityIds, source),
      upsertShares: (rows) => upsertShares(supabase, rows),
    },
    // UC-030(LLM 공시 분석)이 미구현인 동안 no-op — 030 plan이 이 지점을 교체한다(BR-9).
    onFinished: () => {
      console.log("[scheduler] collect_financials finished — analyze_disclosures(030) hook is a no-op for now");
    },
  });

  const collectFxMarketHoursJob = createCollectFxMarketHoursJob({
    toss,
    batchLog,
    fxRepo: {
      upsertRate: (row) => upsertRate(supabase, row),
      findLatestRate: (base, quote) => findLatestRate(supabase, base, quote),
    },
    calendarRepo: {
      upsertDays: (rows) => upsertDays(supabase, rows),
    },
  });

  registerSchedules({
    jobLock,
    collectQuotesJob,
    collectFinancialsJob,
    collectFxMarketHoursJob,
    cronSchedule: (expression, handler, options) => cron.schedule(expression, handler, options),
  });

  console.log("[scheduler] worker started");
}

if (process.env.NODE_ENV !== "test") {
  startScheduler();
}
