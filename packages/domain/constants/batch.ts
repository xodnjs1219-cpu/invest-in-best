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

/* ── UC-027 collect-financials 확장 (docs/usecases/027/plan.md 모듈 1) ── */

/** collect-financials 잡 스케줄: 1일 1회 19:00 KST(양 시장 마감·공시 갱신 이후). */
export const COLLECT_FINANCIALS_CRON = "0 19 * * *";

/** batch_runs.job_type enum 리터럴. */
export const BATCH_JOB_TYPE_COLLECT_FINANCIALS = "collect_financials";

/** cron 실행 타임존(KST) — node-cron timezone 옵션에 사용. */
export const BATCH_TIMEZONE = "Asia/Seoul";

/** running 상태가 이 시간(h) 초과하면 크래시 고아로 간주하고 무시(2차 방어, E16). */
export const BATCH_STALE_RUNNING_HOURS = 24;

/** OpenDART 다중회사 주요계정 조회 청크 크기(외부 계약 상한 100사, status 021 방지). */
export const DART_MULTI_ACNT_CHUNK_SIZE = 100;

/** 공시 조회 룩백 일수 — bgn_de = 당일 - N (전일 마감 이후 접수분 누락 방지). */
export const DISCLOSURE_LOOKBACK_DAYS = 1;

/** OpenDART list.json 페이지당 최대 건수(외부 계약 상한). */
export const DART_PAGE_COUNT = 100;

/** SEC EDGAR 벌크 ZIP 종류. */
export const SEC_BULK_KINDS = ["submissions", "companyfacts"] as const;

/* ── UC-028 collect-fx-market-hours 확장 (docs/usecases/028/plan.md 모듈 1) ── */

/** collect-fx-market-hours 잡 스케줄: 1일 1회 08:30 KST(026 시세 수집보다 선행). */
export const COLLECT_FX_MARKET_HOURS_CRON = "30 8 * * *";

/** batch_runs.job_type enum 리터럴. */
export const BATCH_JOB_TYPE_COLLECT_FX_MARKET_HOURS = "collect_fx_market_hours";

/** cron 실행 타임존(KST) — 026 COLLECT_QUOTES_CRON은 시간대 무관이라 영향 없음. */
export const BATCH_CRON_TIMEZONE = "Asia/Seoul";

/* ── UC-023 배치 모니터링 조회 확장 (docs/usecases/023/plan.md 모듈 1) ── */

/**
 * `batch_runs.job_type` enum 리터럴 6종(0012_batch_runs.sql, BR-3·BR-4).
 * 워커 잡(026~031)의 jobType 인자와 웹의 필터 검증·FE 라벨 키가 공용하는 단일 SOT.
 */
export const BATCH_JOB_TYPES = [
  "collect_quotes",
  "collect_financials",
  "collect_fx_market_hours",
  "aggregate_daily_metrics",
  "analyze_disclosures",
  "backfill_all",
] as const;

export type BatchJobType = (typeof BATCH_JOB_TYPES)[number];

/** `batch_runs.status` enum 리터럴 4종(0012_batch_runs.sql, BR-3). */
export const BATCH_RUN_STATUSES = ["running", "success", "partial_success", "failed"] as const;

export type BatchRunStatus = (typeof BATCH_RUN_STATUSES)[number];

/* ── UC-029 aggregate-daily-metrics 확장 (docs/usecases/029/plan.md 모듈 1) ── */

/** aggregate-daily-metrics 잡 스케줄: 1일 1회 08:00 KST(026 시세 확정·027 재무·028 환율 수집 이후). */
export const AGGREGATE_DAILY_METRICS_CRON = "0 8 * * *";

/** batch_runs.job_type enum 리터럴. */
export const BATCH_JOB_TYPE_AGGREGATE_DAILY_METRICS = "aggregate_daily_metrics";

/**
 * running 상태가 이 시간(h) 초과하면 크래시 고아로 간주하고 중복 판정에서 무시(E10/E11 2차 방어).
 * UC-026의 `BATCH_STALE_RUNNING_HOURS`(24h)는 하루 단위 잡을 전제한 값이라 재사용하지 않고,
 * 본 잡(1일 1회, 짧은 실행)에 맞춘 별도 상수를 둔다.
 */
export const BATCH_RUNNING_STALE_HOURS = 6;

/** 대량 캐치업 시 체인×일자 처리를 창 단위로 분할하는 일수(E13·메모리 상한). */
export const AGGREGATION_DATE_WINDOW_DAYS = 370;

/* ── UC-031 backfill-all 확장 (docs/usecases/031/plan.md 모듈 5) ── */

/** batch_runs.job_type enum 리터럴. */
export const BACKFILL_JOB_TYPE = "backfill_all";

/** 토스 candles 백필 페이지 크기(외부 계약 상한 200, tossinvest-openapi.md §6). */
export const BACKFILL_CANDLE_PAGE_COUNT = 200;

/**
 * 백필의 OpenDART 일일 호출 예산(H-7) — 전체 한도 20,000건 중 정기 수집(027)분을 남겨두기 위한
 * 상한. 020(전체 한도 초과) 도달 전에 백필이 스스로 멈춰 정기 잡의 몫을 보존한다.
 */
export const OPENDART_BACKFILL_DAILY_CALL_BUDGET = 15_000;

/** 분당 호출 상한(안전마진, OpenDART 분당 1,000회 미만 요구사항 대비). */
export const OPENDART_MAX_CALLS_PER_MINUTE = 600;

/** 정기 잡(H-7 경합 대상)이 running인 동안 백필이 재확인하는 폴링 주기(ms). */
export const BACKFILL_REGULAR_JOB_POLL_MS = 30_000;

/** running 상태가 이 시간(ms) 초과하면 크래시 고아로 간주한다(E17, 백필 전용 — 장시간 잡이라 026/027보다 길게 잡음). */
export const BACKFILL_HEARTBEAT_STALE_MS = 600_000;

/** 이 처리 단위 수마다 batch_runs 진행 건수를 갱신한다(하트비트 겸용). */
export const BACKFILL_PROGRESS_UPDATE_EVERY_N_UNITS = 10;

/** 국내 과거 공시 백필 소급 개월 수(H-10 — 공시 백필은 최근 N개월만, 전 구간 아님). */
export const BACKFILL_KRX_DISCLOSURE_MONTHS = 12;

/** OpenDART list.json 기간 조회 상한(3개월) 내로 분할하는 일수(공시 소급 윈도우 분할). */
export const OPENDART_LIST_WINDOW_DAYS = 85;

/**
 * 백필이 기동 시 경합을 확인해야 하는 정기(비백필) 잡 목록(H-7).
 * 이 잡들이 running이면 백필은 체크포인트 처리 단위 사이마다 대기한다(regular-job-guard).
 */
export const BACKFILL_CONFLICT_JOB_TYPES = [
  "collect_quotes",
  "collect_financials",
  "collect_fx_market_hours",
  "aggregate_daily_metrics",
  "analyze_disclosures",
] as const;

/* ── UC-030 analyze-disclosures 확장 (docs/usecases/030/plan.md 모듈 14) ── */

/** batch_runs.job_type enum 리터럴. */
export const BATCH_JOB_TYPE_ANALYZE_DISCLOSURES = "analyze_disclosures";
