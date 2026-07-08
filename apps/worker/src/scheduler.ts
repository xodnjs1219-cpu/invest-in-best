/**
 * 워커 스케줄러 진입점 (docs/usecases/026/plan.md 모듈 8).
 * 기동 시 설정 로드(조기 실패) → Supabase 클라이언트 생성 → 잡 의존성 조립 → cron 등록.
 * 이후 유스케이스(027~030)는 registerSchedules에 cron.schedule 행만 추가한다(1 잡 = 1 파일 원칙 유지).
 */
import cron from "node-cron";
import {
  AGGREGATE_DAILY_METRICS_CRON,
  BATCH_CRON_TIMEZONE,
  BATCH_JOB_TYPE_ANALYZE_DISCLOSURES,
  BATCH_TIMEZONE,
  COLLECT_FINANCIALS_CRON,
  COLLECT_FX_MARKET_HOURS_CRON,
  COLLECT_QUOTES_CRON,
  type BatchRunStatus,
} from "@iib/domain";
import { getWorkerConfig } from "./runtime/config";
import { createWorkerSupabase } from "./runtime/supabase";
import { createJobLock, type JobLock } from "./runtime/job-lock";
import { createBatchLogger } from "./runtime/batch-log";
import { createRateLimiter } from "./runtime/rate-limiter";
import { createTossInvestClient } from "./adapters/tossinvest/client";
import { createOpenDartClient } from "./adapters/opendart/client";
import { createSecEdgarClient } from "./adapters/sec-edgar/client";
import { createLlmClient } from "./adapters/llm/client";
import { createCollectQuotesJob } from "./jobs/collect-quotes.job";
import { createCollectFinancialsJob } from "./jobs/collect-financials.job";
import { createCollectFxMarketHoursJob } from "./jobs/collect-fx-market-hours.job";
import { assembleAggregateDailyMetricsJob } from "./jobs/aggregate-daily-metrics.job";
import { createAnalyzeDisclosuresJob } from "./jobs/analyze-disclosures.job";
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
import {
  listUnanalyzedChunk,
  markAnalyzed,
  upsertDisclosures,
} from "./repositories/disclosures.repository";
import {
  findExistingPeriodKeys,
  upsertFinancials,
} from "./repositories/financials.repository";
import { findLatestBySource, upsertShares } from "./repositories/shares.repository";
import { findLatestRate, upsertRate } from "./repositories/fx.repository";
import { findLatestSnapshotComposition, listActiveOfficialChains } from "./repositories/chains.repository";
import { listActiveRelationTypes } from "./repositories/relation-types.repository";
import { insertPendingProposal, listPendingKeys } from "./repositories/llm-proposals.repository";

const JOB_TYPE_COLLECT_QUOTES = "collect_quotes";
const JOB_TYPE_COLLECT_FINANCIALS = "collect_financials";
const JOB_TYPE_COLLECT_FX_MARKET_HOURS = "collect_fx_market_hours";
const JOB_TYPE_AGGREGATE_DAILY_METRICS = "aggregate_daily_metrics";

export interface CollectQuotesJobPort {
  run(now?: Date): Promise<void>;
}

export interface CollectFinancialsJobPort {
  run(now?: Date): Promise<void>;
}

export interface CollectFxMarketHoursJobPort {
  run(now?: Date): Promise<void>;
}

export interface AggregateDailyMetricsJobPort {
  run(now?: Date): Promise<void>;
}

export interface AnalyzeDisclosuresJobPort {
  run(now?: Date): Promise<BatchRunStatus>;
}

/**
 * collect-financials 종료(success/partial_success) 직후 analyze-disclosures를 연쇄 실행하는
 * 트리거 팩토리(docs/usecases/030/plan.md 모듈 15, R-9). cron 등록이 아니라 collect-financials
 * 잡의 `onFinished` 훅에 연결되는 콜백을 반환한다 — collect-financials.job.ts는 status가
 * success/partial_success일 때만 onFinished를 호출하므로(E12), 이 콜백은 그 조건이 이미 충족된
 * 시점에만 실행된다. 자체 job-lock(`analyze_disclosures`)으로 중복 기동을 방지하고(E13),
 * 잡의 예외를 상위(collect-financials)로 전파하지 않는다(UC-026 모듈 8 패턴과 동일).
 */
export function createAnalyzeDisclosuresTrigger(deps: {
  jobLock: JobLock;
  analyzeDisclosuresJob: AnalyzeDisclosuresJobPort;
}): () => Promise<void> {
  return async () => {
    if (!deps.jobLock.tryAcquire(BATCH_JOB_TYPE_ANALYZE_DISCLOSURES)) {
      console.warn(`[scheduler] ${BATCH_JOB_TYPE_ANALYZE_DISCLOSURES} already running — skip chained trigger`);
      return;
    }
    try {
      await deps.analyzeDisclosuresJob.run();
    } catch (error) {
      console.error(`[scheduler] ${BATCH_JOB_TYPE_ANALYZE_DISCLOSURES} job crashed unexpectedly:`, error);
    } finally {
      deps.jobLock.release(BATCH_JOB_TYPE_ANALYZE_DISCLOSURES);
    }
  };
}

export interface CronScheduleOptions {
  timezone?: string;
}

export interface SchedulerDeps {
  jobLock: JobLock;
  collectQuotesJob: CollectQuotesJobPort;
  collectFinancialsJob?: CollectFinancialsJobPort;
  collectFxMarketHoursJob?: CollectFxMarketHoursJobPort;
  aggregateDailyMetricsJob?: AggregateDailyMetricsJobPort;
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

  if (deps.aggregateDailyMetricsJob) {
    const aggregateDailyMetricsJob = deps.aggregateDailyMetricsJob;
    deps.cronSchedule(
      AGGREGATE_DAILY_METRICS_CRON,
      async () => {
        if (!deps.jobLock.tryAcquire(JOB_TYPE_AGGREGATE_DAILY_METRICS)) {
          console.warn(`[scheduler] ${JOB_TYPE_AGGREGATE_DAILY_METRICS} already running — skip this tick`);
          return;
        }
        try {
          await aggregateDailyMetricsJob.run();
        } catch (error) {
          console.error(`[scheduler] ${JOB_TYPE_AGGREGATE_DAILY_METRICS} job crashed unexpectedly:`, error);
        } finally {
          deps.jobLock.release(JOB_TYPE_AGGREGATE_DAILY_METRICS);
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
      // UC-030 — 보수적 초기값(공급자 문서 확정 시 조정, spec E7).
      LLM: { tps: 1 },
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

  const analyzeDisclosuresJob = createAnalyzeDisclosuresJob({
    // 생성을 잡 실행 시점으로 지연 — LlmConfigError를 잡 수준 실패로 기록 가능하게 함(E14).
    llmFactory: () => createLlmClient({ config, rateLimiter }),
    openDart: dart,
    secEdgar: sec,
    batchLog,
    repos: {
      listActiveOfficialChains: () => listActiveOfficialChains(supabase),
      findLatestSnapshotComposition: (chainId) => findLatestSnapshotComposition(supabase, chainId),
      listActiveRelationTypes: () => listActiveRelationTypes(supabase),
      listUnanalyzedChunk: (params) => listUnanalyzedChunk(supabase, params),
      markAnalyzed: (disclosureIds, analyzedAtIso) => markAnalyzed(supabase, disclosureIds, analyzedAtIso),
      listPendingKeys: (chainIds) => listPendingKeys(supabase, chainIds),
      insertPendingProposal: (row) => insertPendingProposal(supabase, row),
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
    // UC-030(LLM 공시 분석) 연쇄 트리거(R-9) — collect-financials가 success/partial_success로
    // 종료할 때만 이 훅을 호출하므로(E12), 여기서는 analyze-disclosures 자체 잡락만 적용하면 된다.
    onFinished: createAnalyzeDisclosuresTrigger({ jobLock, analyzeDisclosuresJob }),
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

  // 조립 헬퍼로 일원화(UC-031 백필 후속 트리거와 공유 — 중복 제거).
  const aggregateDailyMetricsJob = assembleAggregateDailyMetricsJob(supabase);

  registerSchedules({
    jobLock,
    collectQuotesJob,
    collectFinancialsJob,
    collectFxMarketHoursJob,
    aggregateDailyMetricsJob,
    cronSchedule: (expression, handler, options) => cron.schedule(expression, handler, options),
  });

  console.log("[scheduler] worker started");
}

if (process.env.NODE_ENV !== "test") {
  startScheduler();
}
