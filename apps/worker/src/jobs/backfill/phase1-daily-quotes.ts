/**
 * Phase 1 — 과거 일봉 백필 (docs/usecases/031/plan.md 모듈 16).
 * 종목 단위 candles `before` 소급(빈 배열/`nextBefore=null` 종료), daily_quotes 확정 UPSERT.
 * 적재 성공 이후에만 커서를 전진한다(BR-6 — 적재-커서 정합).
 */
import { TossAuthError, type GetDailyCandlesPageResult, type NormalizedDailyCandle } from "../../adapters/tossinvest/contract";
import { withRetry, type RetryOptions } from "../../runtime/retry";
import type { RepoResult } from "../../repositories/result";
import type { ConfirmedDailyRow } from "../../repositories/quotes.repository";
import { candlesCheckpointKey, parsePhase1Cursor, phase1InitialCursor } from "./checkpoint-plan";

export interface Phase1Target {
  id: string;
  tossSymbol: string;
  market: string;
}

export interface Phase1TossPort {
  getDailyCandlesPage(symbol: string, before?: string): Promise<GetDailyCandlesPageResult>;
}

export interface Phase1Repos {
  upsertConfirmedDaily(rows: ConfirmedDailyRow[]): Promise<RepoResult<void>>;
}

export interface Phase1Checkpoints {
  get(key: string): Promise<RepoResult<{ cursor: unknown; isCompleted: boolean } | null>>;
  upsert(key: string, cursor: unknown, isCompleted: boolean): Promise<RepoResult<void>>;
  complete(key: string): Promise<RepoResult<void>>;
}

export interface Phase1Guard {
  waitUntilIdle(runId: string): Promise<void>;
}

export interface Phase1BatchLog {
  itemFailures(failures: Array<{ securityId: string; attemptCount: number; lastError: string }>): Promise<void>;
}

export interface Phase1Deps {
  toss: Phase1TossPort;
  repos: Phase1Repos;
  checkpoints: Phase1Checkpoints;
  guard: Phase1Guard;
  batchLog: Phase1BatchLog;
  retryOptions?: Partial<RetryOptions>;
}

export interface Phase1Summary {
  processed: number;
  failed: number;
  carriedOver: boolean;
  authFailed: boolean;
}

export interface Phase1Job {
  run(targets: Phase1Target[], runId?: string): Promise<Phase1Summary>;
}

function toConfirmedDailyRow(securityId: string, candle: NormalizedDailyCandle): ConfirmedDailyRow {
  return {
    securityId,
    tradeDate: candle.date,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

/** 429/5xx/네트워크는 재시도, stock-not-found(TossRequestError 404)는 재시도 무의미. */
function shouldRetryPhase1Error(error: unknown): boolean {
  if (error instanceof TossAuthError) return false;
  const status = (error as { status?: number } | undefined)?.status;
  if (status !== undefined) return status === 429 || status >= 500;
  return true;
}

export function createPhase1DailyQuotes(deps: Phase1Deps): Phase1Job {
  const { toss, repos, checkpoints, guard, batchLog } = deps;
  const retryOptions = deps.retryOptions ?? {};

  return {
    async run(targets: Phase1Target[], runId = "backfill"): Promise<Phase1Summary> {
      let processed = 0;
      let failed = 0;
      let carriedOver = false;

      for (const target of targets) {
        const key = candlesCheckpointKey(target.id);
        const existing = await checkpoints.get(key);
        if (existing.ok && existing.data?.isCompleted) {
          continue; // E1: 이미 완료된 종목은 스킵(재개)
        }

        await guard.waitUntilIdle(runId);

        let cursor = existing.ok && existing.data ? parsePhase1Cursor(existing.data.cursor) : phase1InitialCursor();

        try {
          for (;;) {
            const page = await withRetry(
              () => toss.getDailyCandlesPage(target.tossSymbol, cursor.before ?? undefined),
              { shouldRetry: shouldRetryPhase1Error, ...retryOptions },
            );

            if (page.candles.length > 0) {
              const rows = page.candles.map((c) => toConfirmedDailyRow(target.id, c));
              const upsertResult = await repos.upsertConfirmedDaily(rows);
              if (!upsertResult.ok) {
                // 적재 실패 — 커서를 전진시키지 않고 이 종목 처리를 중단(BR-6, 다음 실행에서 동일 지점부터 재시도).
                failed += 1;
                break;
              }
              processed += rows.length;
            }

            if (page.nextBefore === null) {
              await checkpoints.complete(key);
              break;
            }

            cursor = { before: page.nextBefore };
            await checkpoints.upsert(key, cursor, false);
          }
        } catch (error) {
          if (error instanceof TossAuthError) {
            return { processed, failed, carriedOver: true, authFailed: true };
          }
          // E8/E5: 지속 오류(429 등) — 이 종목 커서를 보존하고 이월, 다음 종목 계속.
          carriedOver = true;
          failed += 1;
          await batchLog.itemFailures([
            { securityId: target.id, attemptCount: 1, lastError: (error as Error).message },
          ]);
        }
      }

      return { processed, failed, carriedOver, authFailed: false };
    },
  };
}
