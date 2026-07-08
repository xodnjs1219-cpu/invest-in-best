/**
 * 환율·장운영 수집 잡 (docs/usecases/028/plan.md 모듈 8).
 * 오케스트레이터: 환율 스텝 + 시장별(KR→US) 캘린더 스텝 → 스텝 결과 취합 → batch_runs 기록.
 * 전 의존성 주입형. 잡 전체를 try/catch로 감싸 어떤 예외도 스케줄러 프로세스로 전파하지 않는다.
 */
import { BATCH_ERROR_LOG_MAX_LENGTH, FX_PAIR, MARKETS, type MarketCode } from "@iib/domain";
import type { GetExchangeRateResult, NormalizedCalendarDay } from "../adapters/tossinvest/contract";
import { TossAuthError } from "../adapters/tossinvest/contract";
import type { BatchLogger } from "../runtime/batch-log";
import type { FinishRunInput } from "../repositories/batch.repository";
import type { FxRateRow } from "../repositories/fx.repository";
import type { UpsertCalendarDayInput } from "../repositories/market-calendar.repository";
import type { RepoResult } from "../repositories/result";

const JOB_TYPE = "collect_fx_market_hours";

/** 잡 전용 내부 에러 코드(spec §API 3) — 다른 잡과 공유하지 않는다. */
const ERROR_CODES = {
  TOSS_AUTH_FAILED: "TOSS_AUTH_FAILED",
  FX_FETCH_FAILED: "FX_FETCH_FAILED",
  FX_VALIDATION_FAILED: "FX_VALIDATION_FAILED",
  CALENDAR_FETCH_FAILED: "CALENDAR_FETCH_FAILED",
  CALENDAR_VALIDATION_FAILED: "CALENDAR_VALIDATION_FAILED",
  DB_UPSERT_FAILED: "DB_UPSERT_FAILED",
} as const;

export interface CollectFxMarketHoursToss {
  getExchangeRate(now: Date): Promise<GetExchangeRateResult>;
  getMarketCalendar(market: MarketCode, now: Date): Promise<NormalizedCalendarDay[]>;
}

export interface CollectFxMarketHoursFxRepo {
  upsertRate(row: FxRateRow): Promise<RepoResult<void>>;
  findLatestRate(base: "USD" | "KRW", quote: "USD" | "KRW"): Promise<RepoResult<{ rateDate: string; rate: number } | null>>;
}

export interface CollectFxMarketHoursCalendarRepo {
  upsertDays(rows: UpsertCalendarDayInput[]): Promise<RepoResult<{ count: number }>>;
}

export interface CollectFxMarketHoursJobDeps {
  toss: CollectFxMarketHoursToss;
  fxRepo: CollectFxMarketHoursFxRepo;
  calendarRepo: CollectFxMarketHoursCalendarRepo;
  batchLog: BatchLogger;
}

export interface CollectFxMarketHoursJob {
  run(now?: Date): Promise<void>;
}

interface StepOutcome {
  ok: boolean;
  processed: number;
  errorEntry: string | null;
}

export function createCollectFxMarketHoursJob(deps: CollectFxMarketHoursJobDeps): CollectFxMarketHoursJob {
  const { toss, fxRepo, calendarRepo, batchLog } = deps;

  return {
    async run(now: Date = new Date()): Promise<void> {
      const runId = await batchLog.start(JOB_TYPE);
      if (runId === null) {
        console.error("[collect-fx-market-hours] failed to start a batch_runs record — proceeding without runId tracking");
      }

      try {
        await runInternal(runId, now);
      } catch (error) {
        console.error("[collect-fx-market-hours] unexpected exception:", error);
        if (runId !== null) {
          await batchLog.finish(runId, {
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

  async function runInternal(runId: string | null, now: Date): Promise<void> {
    const outcomes: StepOutcome[] = [];

    // ── 환율 스텝 ──
    const fxOutcome = await runFxStep(now);
    outcomes.push(fxOutcome);

    if (isAuthFailure(fxOutcome)) {
      await finishWithAuthFailure(runId, outcomes);
      return;
    }

    // ── 캘린더 스텝(시장별 순차 KR → US) ──
    for (const market of MARKETS) {
      const calendarOutcome = await runCalendarStep(market, now);
      outcomes.push(calendarOutcome);

      if (isAuthFailure(calendarOutcome)) {
        await finishWithAuthFailure(runId, outcomes);
        return;
      }
    }

    // ── 종료 기록 ──
    const processedCount = outcomes.reduce((sum, o) => sum + o.processed, 0);
    const failedCount = outcomes.filter((o) => !o.ok).length;
    const errorEntries = outcomes.filter((o) => o.errorEntry !== null).map((o) => o.errorEntry!);
    const errorLog = errorEntries.length > 0 ? truncate(errorEntries.join("; ")) : null;

    let status: FinishRunInput["status"];
    if (failedCount === 0) {
      status = "success";
    } else if (failedCount === outcomes.length) {
      status = "failed";
    } else {
      status = "partial_success";
    }

    await finish(runId, { status, processedCount, failedCount, isCarriedOver: false, errorLog });
  }

  async function runFxStep(now: Date): Promise<StepOutcome> {
    let result: GetExchangeRateResult;
    try {
      result = await toss.getExchangeRate(now);
    } catch (error) {
      if (error instanceof TossAuthError) {
        return { ok: false, processed: 0, errorEntry: `${ERROR_CODES.TOSS_AUTH_FAILED}: ${error.message}` };
      }
      const latestResult = await fxRepo.findLatestRate(FX_PAIR.base, FX_PAIR.quote);
      const carryForwardNote = latestResult.ok && latestResult.data
        ? `carry-forward 가능(최신 rate_date=${latestResult.data.rateDate})`
        : "carry-forward 불가(직전 관측값 없음)";
      return {
        ok: false,
        processed: 0,
        errorEntry: `${ERROR_CODES.FX_FETCH_FAILED}: ${(error as Error).message} — ${carryForwardNote}`,
      };
    }

    if (result.kind === "not_published") {
      return { ok: true, processed: 0, errorEntry: null }; // 결측 허용(spec BR-3) — 스텝 성공 취급
    }

    const upsertResult = await fxRepo.upsertRate({
      rateDate: result.rate.rateDate,
      baseCurrency: result.rate.baseCurrency,
      quoteCurrency: result.rate.quoteCurrency,
      rate: result.rate.rate,
      source: "toss",
    });
    if (!upsertResult.ok) {
      return { ok: false, processed: 0, errorEntry: `${ERROR_CODES.DB_UPSERT_FAILED}(fx_rates): ${upsertResult.error}` };
    }
    return { ok: true, processed: 1, errorEntry: null };
  }

  async function runCalendarStep(market: MarketCode, now: Date): Promise<StepOutcome> {
    let days: NormalizedCalendarDay[];
    try {
      days = await toss.getMarketCalendar(market, now);
    } catch (error) {
      if (error instanceof TossAuthError) {
        return { ok: false, processed: 0, errorEntry: `${ERROR_CODES.TOSS_AUTH_FAILED}: ${error.message}` };
      }
      return {
        ok: false,
        processed: 0,
        errorEntry: `${ERROR_CODES.CALENDAR_FETCH_FAILED}(${market}): ${(error as Error).message}`,
      };
    }

    const upsertResult = await calendarRepo.upsertDays(
      days.map((d) => ({
        market: d.market,
        calendarDate: d.calendarDate,
        isTradingDay: d.isTradingDay,
        openAt: d.openAt,
        closeAt: d.closeAt,
        isEarlyClose: d.isEarlyClose,
      })),
    );
    if (!upsertResult.ok) {
      return {
        ok: false,
        processed: 0,
        errorEntry: `${ERROR_CODES.DB_UPSERT_FAILED}(market_calendar,${market}): ${upsertResult.error}`,
      };
    }
    return { ok: true, processed: upsertResult.data.count, errorEntry: null };
  }

  function isAuthFailure(outcome: StepOutcome): boolean {
    return outcome.errorEntry?.startsWith(ERROR_CODES.TOSS_AUTH_FAILED) ?? false;
  }

  async function finishWithAuthFailure(runId: string | null, outcomes: StepOutcome[]): Promise<void> {
    const processedCount = outcomes.reduce((sum, o) => sum + o.processed, 0);
    const errorEntries = outcomes.filter((o) => o.errorEntry !== null).map((o) => o.errorEntry!);
    await finish(runId, {
      status: "failed",
      processedCount,
      failedCount: outcomes.length,
      isCarriedOver: false,
      errorLog: truncate(errorEntries.join("; ")),
    });
  }

  async function finish(runId: string | null, summary: FinishRunInput): Promise<void> {
    if (runId === null) {
      console.error("[collect-fx-market-hours] no runId — skipping finish() record", summary);
      return;
    }
    await batchLog.finish(runId, summary);
  }
}

function truncate(errorLog: string): string {
  return errorLog.length > BATCH_ERROR_LOG_MAX_LENGTH ? errorLog.slice(0, BATCH_ERROR_LOG_MAX_LENGTH) : errorLog;
}
