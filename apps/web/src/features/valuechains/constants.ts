/**
 * chain-view 페이지(UC-009~012) FE 캐싱·타임아웃 상수 — 하드코딩 금지 원칙에 따라 훅에서 리터럴 사용 금지.
 */

/** 노드 상세 쿼리 staleTime(ms) — 구조 데이터와 동일 원천이라 세션 내 재클릭 시 재호출 억제(BR-5). */
export const NODE_DETAIL_STALE_TIME_MS = 5 * 60_000;

/** 타임라인 메타 쿼리 staleTime(ms) — 마커 목록은 세션 중 자주 바뀌지 않는다. */
export const TIMELINE_META_STALE_TIME_MS = 60_000;

/** 대시보드 지표 쿼리 staleTime(ms) — 집계는 1일 1회 갱신되므로 페이지 체류 중 재요청을 억제한다. */
export const DASHBOARD_METRICS_STALE_TIME_MS = 60_000;

/** 스냅샷 복원 쿼리 staleTime(ms) — 과거 시점 구조는 불변이므로 길게 캐시한다. */
export const SNAPSHOT_AT_STALE_TIME_MS = 5 * 60_000;
