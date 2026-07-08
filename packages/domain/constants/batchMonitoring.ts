/**
 * 어드민 배치 모니터링 조회(UC-023) 전용 상수 (docs/usecases/023/plan.md 모듈 2, BR-7).
 * FE 훅/BE 스키마·서비스가 공용하는 단일 SOT — 하드코딩 금지.
 */

/** `GET /admin/batches/runs` 목록 페이지 크기 기본값. */
export const ADMIN_BATCH_RUNS_PAGE_SIZE_DEFAULT = 20;

/** `GET /admin/batches/runs` 목록 페이지 크기 상한값. */
export const ADMIN_BATCH_RUNS_PAGE_SIZE_MAX = 100;

/** `GET /admin/batches/runs/:runId/failures` 목록 페이지 크기 기본값. */
export const ADMIN_BATCH_FAILURES_PAGE_SIZE_DEFAULT = 20;

/** `GET /admin/batches/runs/:runId/failures` 목록 페이지 크기 상한값. */
export const ADMIN_BATCH_FAILURES_PAGE_SIZE_MAX = 100;

/** `from` 미지정 시 적용하는 기본 조회 기간(일수, R-4·E3). */
export const BATCH_RUNS_DEFAULT_LOOKBACK_DAYS = 14;

/** 진행 중(running) 실행 존재 시 목록/백필 진행률 폴링 주기(ms, R-6·E2·Main 7). */
export const BATCH_RUNS_POLL_INTERVAL_MS = 10_000;
