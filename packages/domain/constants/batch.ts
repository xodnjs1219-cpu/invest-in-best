/**
 * 배치 공통 상수 (docs/usecases/026/plan.md 모듈 9).
 * 워커 잡(UC-026~031)이 공유하는 단일 SOT — 하드코딩 금지 원칙의 근거 지점.
 */

/** collect-quotes 잡 스케줄: 매시 정각 (spec 6.2(1)). */
export const COLLECT_QUOTES_CRON = "0 * * * *";

/** batch_runs.job_type enum 리터럴 (0012_batch_runs.sql). */
export const BATCH_JOB_TYPE_COLLECT_QUOTES = "collect_quotes";

/** 시간별 원본(quote_ticks) 보존 일수 (BR-4). */
export const QUOTE_TICKS_RETENTION_DAYS = 30;

/** 종목/청크 단위 최대 재시도 횟수 (BR-7, 지수 백오프). */
export const BATCH_MAX_RETRY = 3;

/** 지수 백오프 기본 지연 (ms). */
export const BATCH_RETRY_BASE_DELAY_MS = 1_000;

/** 토스 prices/stocks `symbols` 파라미터 상한 (tossinvest-openapi.md §8.2 — 최대 200). */
export const TOSS_SYMBOLS_CHUNK_SIZE = 200;

/** Supabase 배열 UPSERT 청크 크기 (techstack §7 — 1,000~5,000행). */
export const DB_UPSERT_CHUNK_SIZE = 1_000;

/** 워커 HTTP 타임아웃 (ms) — 대량 UPSERT를 고려해 웹보다 여유 있게. */
export const WORKER_HTTP_TIMEOUT_MS = 60_000;

/** batch_runs.error_log 요약 문자열 길이 상한 (모듈 7). */
export const BATCH_ERROR_LOG_MAX_LENGTH = 2_000;
