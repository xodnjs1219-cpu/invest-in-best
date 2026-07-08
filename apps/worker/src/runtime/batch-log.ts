/**
 * 배치 실행 기록기 (docs/usecases/026/plan.md 모듈 7).
 * batch.repository.ts를 감싼 잡 공용 파사드. 기록 실패 자체는 잡을 실패시키지 않고
 * console.error로만 남긴다(모니터링 기록이 본 작업을 차단하지 않음).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { BATCH_ERROR_LOG_MAX_LENGTH } from "@iib/domain";
import {
  findRunningRun,
  finishRun,
  findUnresolvedFailures,
  insertItemFailures,
  insertRun,
  resolveFailures,
  type FinishRunInput,
  type ItemFailureInput,
  type UnresolvedFailure,
} from "../repositories/batch.repository";

export interface BatchLogger {
  start(jobType: string, targetMarket?: string): Promise<string | null>;
  finish(runId: string, summary: FinishRunInput): Promise<void>;
  itemFailures(runId: string, failures: ItemFailureInput[]): Promise<void>;
  resolve(failureIds: string[]): Promise<void>;
  unresolvedFailures(jobType: string): Promise<UnresolvedFailure[]>;
  /**
   * 동일 잡의 running 실행이 있는지 DB 레벨로 검사한다(E16 2차 방어).
   * 크래시 고아 행으로 영구 스킵되지 않도록 staleHours 초과한 running 행은 무시(경고 로그)한다.
   */
  isRunning(jobType: string, staleHours: number): Promise<boolean>;
}

/** error_log 요약 문자열 길이 상한 적용. */
function truncateErrorLog(errorLog: string | null): string | null {
  if (errorLog === null) return null;
  return errorLog.length > BATCH_ERROR_LOG_MAX_LENGTH
    ? errorLog.slice(0, BATCH_ERROR_LOG_MAX_LENGTH)
    : errorLog;
}

export function createBatchLogger(client: SupabaseClient): BatchLogger {
  return {
    async start(jobType: string, targetMarket?: string): Promise<string | null> {
      const result = await insertRun(client, { jobType, targetMarket });
      if (!result.ok) {
        console.error(`[batch-log] start(${jobType}) failed: ${result.error}`);
        return null;
      }
      return result.data.runId;
    },

    async finish(runId: string, summary: FinishRunInput): Promise<void> {
      const result = await finishRun(client, runId, {
        ...summary,
        errorLog: truncateErrorLog(summary.errorLog),
      });
      if (!result.ok) {
        console.error(`[batch-log] finish(${runId}) failed: ${result.error}`);
      }
    },

    async itemFailures(runId: string, failures: ItemFailureInput[]): Promise<void> {
      const result = await insertItemFailures(client, runId, failures);
      if (!result.ok) {
        console.error(`[batch-log] itemFailures(${runId}) failed: ${result.error}`);
      }
    },

    async resolve(failureIds: string[]): Promise<void> {
      const result = await resolveFailures(client, failureIds);
      if (!result.ok) {
        console.error(`[batch-log] resolve(...) failed: ${result.error}`);
      }
    },

    async unresolvedFailures(jobType: string): Promise<UnresolvedFailure[]> {
      const result = await findUnresolvedFailures(client, jobType);
      if (!result.ok) {
        console.error(`[batch-log] unresolvedFailures(${jobType}) failed: ${result.error}`);
        return [];
      }
      return result.data;
    },

    async isRunning(jobType: string, staleHours: number): Promise<boolean> {
      const result = await findRunningRun(client, jobType);
      if (!result.ok) {
        console.error(`[batch-log] isRunning(${jobType}) failed: ${result.error}`);
        return false;
      }
      if (result.data === null) return false;

      const startedAtMs = new Date(result.data.startedAt).getTime();
      const ageHours = (Date.now() - startedAtMs) / (60 * 60 * 1000);
      if (ageHours > staleHours) {
        console.warn(
          `[batch-log] ${jobType} has a stale running row (started ${ageHours.toFixed(1)}h ago) — treating as crash orphan, ignoring`,
        );
        return false;
      }
      return true;
    },
  };
}
