/**
 * 백필 잡 진입점 (docs/usecases/031/plan.md 모듈 19).
 * CLI 진입(main) + 오케스트레이터: 경합 확인 → 실행 기록 → 체크포인트 로드/큐 생성 → Phase 0~3 → 종료 판정 → UC-029 후속 연결.
 * 잡 전체를 try/catch로 감싸 어떤 예외도 프로세스로 전파하지 않는다(E17 최상위 방어).
 */
import { BACKFILL_HEARTBEAT_STALE_MS, BACKFILL_JOB_TYPE } from "@iib/domain";
import type { RepoResult } from "../repositories/result";
import type { RunningRun, FinishRunInput } from "../repositories/batch.repository";
import type { FinancialsTargetSecurity } from "../repositories/securities.repository";
import type { Phase0Job } from "./backfill/phase0-seed-securities";
import type { Phase1Job, Phase1Target } from "./backfill/phase1-daily-quotes";
import type { Phase2Job, Phase2Target } from "./backfill/phase2-krx-financials";
import type { Phase3Job, Phase3Target } from "./backfill/phase3-us-financials";
import { getWorkerConfig } from "../runtime/config";
import { createWorkerSupabase } from "../runtime/supabase";
import { createRateLimiter } from "../runtime/rate-limiter";
import { createTossInvestClient } from "../adapters/tossinvest/client";
import { createOpenDartClient } from "../adapters/opendart/client";
import { createSecEdgarClient } from "../adapters/sec-edgar/client";
import {
  findRunningRun,
  insertRun,
  finishRun,
  insertItemFailures,
  markRunOrphaned,
  updateRunProgress,
  type ItemFailureInput,
} from "../repositories/batch.repository";
import {
  findIncompleteCheckpoints,
  deleteAllCheckpoints,
  getCheckpoint,
  upsertCheckpoint,
  completeCheckpoint,
} from "../repositories/checkpoints.repository";
import {
  findAllForFinancials,
  findAllTickers,
  flagSharesManualOverride,
  upsertSecuritySeeds,
} from "../repositories/securities.repository";
import { upsertShares } from "../repositories/shares.repository";
import { upsertConfirmedDaily } from "../repositories/quotes.repository";
import { upsertProfiles } from "../repositories/company-profiles.repository";
import { upsertDisclosures } from "../repositories/disclosures.repository";
import { upsertFinancials } from "../repositories/financials.repository";
import { createRegularJobGuard } from "./backfill/regular-job-guard";
import { createPhase0SeedSecurities } from "./backfill/phase0-seed-securities";
import { createPhase1DailyQuotes } from "./backfill/phase1-daily-quotes";
import { createPhase2KrxFinancials } from "./backfill/phase2-krx-financials";
import { createPhase3UsFinancials } from "./backfill/phase3-us-financials";

export interface BackfillBatchRepo {
  findRunningRun(jobType: string): Promise<RepoResult<RunningRun | null>>;
  insertRun(input: { jobType: string }): Promise<RepoResult<{ runId: string }>>;
  finishRun(runId: string, input: FinishRunInput): Promise<RepoResult<void>>;
  markRunOrphaned(runId: string): Promise<RepoResult<void>>;
  updateRunProgress(runId: string, input: { processedCount: number; failedCount: number }): Promise<RepoResult<void>>;
}

export interface BackfillCheckpointsRepo {
  findIncompleteCheckpoints(jobType: string): Promise<RepoResult<Array<{ checkpointKey: string; cursor: unknown }>>>;
  deleteAllCheckpoints(jobType: string): Promise<RepoResult<void>>;
  get(jobType: string, key: string): Promise<RepoResult<{ cursor: unknown; isCompleted: boolean } | null>>;
  upsert(jobType: string, key: string, cursor: unknown, isCompleted: boolean): Promise<RepoResult<void>>;
  complete(jobType: string, key: string): Promise<RepoResult<void>>;
}

export interface BackfillSecuritiesRepo {
  findAllForFinancials(): Promise<RepoResult<FinancialsTargetSecurity[]>>;
}

export interface BackfillGuard {
  waitUntilIdle(runId: string): Promise<void>;
}

export interface BackfillAllJobDeps {
  batchRepo: BackfillBatchRepo;
  checkpointsRepo: BackfillCheckpointsRepo;
  securitiesRepo: BackfillSecuritiesRepo;
  guard: BackfillGuard;
  phase0: Phase0Job;
  phase1: Phase1Job;
  phase2: Phase2Job;
  phase3: Phase3Job;
  /** UC-029 잡 구현 전에는 미주입 — no-op(안내 로그)으로 처리(BR-10). */
  runFollowUpAggregation?: () => Promise<void>;
}

export interface BackfillRunOptions {
  reset?: boolean;
}

export interface BackfillAllJob {
  run(options?: BackfillRunOptions): Promise<void>;
}

export function createBackfillAllJob(deps: BackfillAllJobDeps): BackfillAllJob {
  const { batchRepo, checkpointsRepo, securitiesRepo, guard, phase0, phase1, phase2, phase3, runFollowUpAggregation } = deps;

  return {
    async run(options: BackfillRunOptions = {}): Promise<void> {
      let runId: string | null = null;

      try {
        // [기동 검사] 동일 잡(backfill_all) running 확인 — 신선하면 스킵, stale이면 고아 처리 후 진행(E17).
        const existingRun = await batchRepo.findRunningRun(BACKFILL_JOB_TYPE);
        if (existingRun.ok && existingRun.data !== null) {
          const ageMs = Date.now() - new Date(existingRun.data.startedAt).getTime();
          if (ageMs <= BACKFILL_HEARTBEAT_STALE_MS) {
            console.warn("[backfill-all] already running — skip this invocation");
            return;
          }
          console.warn("[backfill-all] stale running row detected — treating as crash orphan (E17)");
          await batchRepo.markRunOrphaned(existingRun.data.id);
        }

        // [리셋(H-8)] 미완료 실행 없음을 위에서 이미 확인했으므로 안전하게 진행.
        if (options.reset) {
          console.warn("[backfill-all] --reset requested — deleting all backfill_all checkpoints (H-8)");
          await checkpointsRepo.deleteAllCheckpoints(BACKFILL_JOB_TYPE);
        }

        // [시작 기록]
        const insertResult = await batchRepo.insertRun({ jobType: BACKFILL_JOB_TYPE });
        if (!insertResult.ok) {
          console.error(`[backfill-all] failed to record run start: ${insertResult.error}`);
          return;
        }
        runId = insertResult.data.runId;

        // [H-7] 정기 잡 경합 확인 — running이면 대기.
        await guard.waitUntilIdle(runId);

        // [대상 종목 로드]
        const targetsResult = await securitiesRepo.findAllForFinancials();
        const targets = targetsResult.ok ? targetsResult.data : [];
        const krxTargets: Phase2Target[] = targets
          .filter((t): t is FinancialsTargetSecurity & { dartCorpCode: string } => t.market === "KRX" && t.dartCorpCode !== null)
          .map((t) => ({ id: t.id, dartCorpCode: t.dartCorpCode, ticker: t.ticker }));
        const usTargets: Phase3Target[] = targets
          .filter((t): t is FinancialsTargetSecurity & { cik: string } => t.market === "US" && t.cik !== null)
          .map((t) => ({ id: t.id, cik: t.cik }));
        const phase1Targets: Phase1Target[] = targets
          .filter((t): t is FinancialsTargetSecurity & { tossSymbol: string } => t.tossSymbol !== null)
          .map((t) => ({ id: t.id, tossSymbol: t.tossSymbol, market: t.market }));

        // [Phase 0~3 순차 실행]
        await phase0.run(runId);
        const p1 = await phase1.run(phase1Targets, runId);
        const p2 = await phase2.run(krxTargets);
        const p3 = await phase3.run(usTargets, runId);

        const processedCount = p1.processed + p2.processed + p3.processed;
        const failedCount = p1.failed + p2.failed + p3.failed;
        const isCarriedOver = p1.carriedOver || p2.carriedOver || p3.carriedOver;
        await batchRepo.updateRunProgress(runId, { processedCount, failedCount });

        // [종료 판정]
        let status: FinishRunInput["status"];
        let errorLog: string | null = null;
        if (p1.authFailed) {
          status = "failed";
          errorLog = "토스 인증 실패로 전체 실행 중단(E9)";
        } else if (isCarriedOver) {
          status = "partial_success";
          errorLog = "일일 한도·레이트 리밋으로 잔여분 이월 — 익일 재실행 시 커서부터 재개(E3)";
        } else if (failedCount > 0) {
          status = "partial_success";
        } else {
          status = "success";
        }

        await batchRepo.finishRun(runId, {
          status,
          processedCount,
          failedCount,
          isCarriedOver,
          errorLog,
        });

        if (status === "success") {
          if (runFollowUpAggregation) {
            await runFollowUpAggregation();
          } else {
            console.log("[backfill-all] completed — aggregate_daily_metrics(UC-029) follow-up hook not injected yet, no-op");
          }
        }
      } catch (error) {
        console.error("[backfill-all] unexpected exception:", error);
        if (runId !== null) {
          await batchRepo.finishRun(runId, {
            status: "failed",
            processedCount: 0,
            failedCount: 0,
            isCarriedOver: false,
            errorLog: `예상 밖 예외: ${(error as Error).message ?? String(error)}`,
          });
        }
      }
    },
  };
}

/**
 * 실 프로세스 조립 — CLI 진입점(`npm run backfill -w apps/worker`). scheduler.ts의 조립 패턴과 동일하게
 * config 로드(조기 실패) → Supabase 클라이언트 → 어댑터·리포지토리 → Phase → Job 순으로 구성한다.
 * scheduler.ts 자체는 수정하지 않는다(backfill은 cron 미등록 — spec 6.2(1), R-6).
 */
export function assembleBackfillAllJob(): BackfillAllJob {
  const config = getWorkerConfig(); // 조기 실패: 필수 env 누락 시 여기서 프로세스 기동 중단
  const supabase = createWorkerSupabase(config);
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

  const batchRepo: BackfillBatchRepo = {
    findRunningRun: (jobType) => findRunningRun(supabase, jobType),
    insertRun: (input) => insertRun(supabase, input),
    finishRun: (runId, input) => finishRun(supabase, runId, input),
    markRunOrphaned: (runId) => markRunOrphaned(supabase, runId),
    updateRunProgress: (runId, input) => updateRunProgress(supabase, runId, input),
  };

  const checkpointsRepo: BackfillCheckpointsRepo = {
    findIncompleteCheckpoints: (jobType) => findIncompleteCheckpoints(supabase, jobType),
    deleteAllCheckpoints: (jobType) => deleteAllCheckpoints(supabase, jobType),
    get: (jobType, key) => getCheckpoint(supabase, jobType, key),
    upsert: (jobType, key, cursor, isCompleted) => upsertCheckpoint(supabase, jobType, key, cursor, isCompleted),
    complete: (jobType, key) => completeCheckpoint(supabase, jobType, key),
  };

  const securitiesRepo: BackfillSecuritiesRepo = {
    findAllForFinancials: () => findAllForFinancials(supabase),
  };

  // Phase 모듈은 조립 시점에 runId를 모르므로(run() 호출 시 결정), 현재 runId를 담는 박스를 클로저로 공유한다.
  // guard.waitUntilIdle(runId)는 오케스트레이터가 Phase 실행 직전 항상 먼저 호출하므로 이 시점에 box를 채운다.
  const currentRunIdBox: { runId: string | null } = { runId: null };
  const innerGuard = createRegularJobGuard({
    batchRepo: { findRunningRun: (jobType) => findRunningRun(supabase, jobType) },
    onWait: (runId) => updateRunProgress(supabase, runId, { processedCount: 0, failedCount: 0 }).then(() => undefined),
  });
  const guard = {
    waitUntilIdle: async (runId: string) => {
      currentRunIdBox.runId = runId;
      await innerGuard.waitUntilIdle(runId);
    },
  };

  const scopedCheckpoints = (jobType: string) => ({
    get: (key: string) => getCheckpoint(supabase, jobType, key),
    upsert: (key: string, cursor: unknown, isCompleted: boolean) =>
      upsertCheckpoint(supabase, jobType, key, cursor, isCompleted),
    complete: (key: string) => completeCheckpoint(supabase, jobType, key),
  });

  const sharedBatchLog = {
    itemFailures: async (failures: ItemFailureInput[]) => {
      if (currentRunIdBox.runId === null || failures.length === 0) return;
      await insertItemFailures(supabase, currentRunIdBox.runId, failures);
    },
  };

  const phase0 = createPhase0SeedSecurities({
    dart,
    sec,
    toss,
    repos: {
      upsertSecuritySeeds: (rows) => upsertSecuritySeeds(supabase, rows),
      upsertShares: (rows) => upsertShares(supabase, rows),
      findAllTickers: () => findAllTickers(supabase),
    },
    checkpoints: scopedCheckpoints(BACKFILL_JOB_TYPE),
    guard,
  });

  const phase1 = createPhase1DailyQuotes({
    toss,
    repos: { upsertConfirmedDaily: (rows) => upsertConfirmedDaily(supabase, rows) },
    checkpoints: scopedCheckpoints(BACKFILL_JOB_TYPE),
    guard,
    batchLog: sharedBatchLog,
  });

  const phase2 = createPhase2KrxFinancials({
    dart,
    repos: {
      upsertProfiles: (rows) => upsertProfiles(supabase, rows),
      upsertShares: (rows) => upsertShares(supabase, rows),
      upsertDisclosures: (rows) => upsertDisclosures(supabase, rows),
      upsertFinancials: (rows) => upsertFinancials(supabase, rows),
    },
    checkpoints: scopedCheckpoints(BACKFILL_JOB_TYPE),
    guard,
    batchLog: sharedBatchLog,
  });

  const phase3 = createPhase3UsFinancials({
    sec,
    repos: {
      upsertFinancials: (rows) => upsertFinancials(supabase, rows),
      upsertShares: (rows) => upsertShares(supabase, rows),
      upsertDisclosures: (rows) => upsertDisclosures(supabase, rows),
      upsertProfiles: (rows) => upsertProfiles(supabase, rows),
      flagSharesManualOverride: (securityIds) => flagSharesManualOverride(supabase, securityIds),
    },
    checkpoints: scopedCheckpoints(BACKFILL_JOB_TYPE),
    guard,
    batchLog: sharedBatchLog,
  });

  return createBackfillAllJob({
    batchRepo,
    checkpointsRepo,
    securitiesRepo,
    guard,
    phase0,
    phase1,
    phase2,
    phase3,
    // UC-029 잡 구현 후 CLI 조립부 한 줄로 연결(BR-10) — 현재는 미구현이므로 미주입.
  });
}

async function main(): Promise<void> {
  const job = assembleBackfillAllJob();
  const reset = process.argv.includes("--reset");
  await job.run({ reset });
}

if (process.env.NODE_ENV !== "test" && process.argv[1]?.includes("backfill-all.job")) {
  main().catch((error) => {
    console.error("[backfill-all] fatal error during CLI execution:", error);
    process.exitCode = 1;
  });
}
