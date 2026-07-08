/**
 * TanStack Query 공통 옵션 상수 (UC-009 plan 모듈 A6·C3).
 * FE(QueryProvider 전역 기본값·개별 쿼리 훅)가 공유하는 SOT — 하드코딩 금지.
 */

/** 전역 기본 staleTime(ms) — 짧은 재검증 주기로 과도한 refetch를 방지한다. */
export const DEFAULT_QUERY_STALE_TIME_MS = 30_000;

/**
 * 밸류체인 구조 쿼리 staleTime(ms) — 페이지 체류 중 캐시 재사용 목적(state_management.md §6,
 * UC-012 "최신으로 돌아가기" 캐시 히트 대비). 구조는 조회 전용이라 서버 변경 빈도가 낮다.
 */
export const CHAIN_STRUCTURE_STALE_TIME_MS = 60_000;

/** 전역 기본 재시도 횟수 — 4xx는 개별 쿼리 훅에서 재시도 금지로 오버라이드한다. */
export const DEFAULT_QUERY_RETRY_COUNT = 1;
