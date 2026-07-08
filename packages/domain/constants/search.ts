/**
 * UC-008 통합 종목 검색 상수 (spec §Business Rules, 결정 B-3·B-4).
 * FE(디바운스 커밋·검색 쿼리 훅)와 BE(service.ts)가 공유하는 SOT — 하드코딩 금지.
 * `CHAIN_LIST_PAGE_SIZE`(UC-007)와는 결정 B-3에 따라 분리된 독립 상수다.
 */

/** 검색 결과 페이지당 건수. */
export const SEARCH_PAGE_SIZE = 20;

/** 검색 실행을 위한 최소(정규화 후) 검색어 길이 — 한글 1자 검색 허용(결정 B-4). */
export const MIN_SEARCH_QUERY_LENGTH = 1;

/** FE 검색 입력 디바운스 지연(ms). */
export const SEARCH_DEBOUNCE_MS = 300;
