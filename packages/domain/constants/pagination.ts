/**
 * 목록 페이지네이션 공통 상수 (UC-007 plan 모듈 A-1, 결정 B-3).
 * FE(쿼리 훅)와 BE(schema.ts)가 공유하는 SOT — 하드코딩 금지.
 * `SEARCH_PAGE_SIZE`(UC-008, search.ts)와는 결정 B-3에 따라 분리된 독립 상수다.
 */

/** 체인 카드 목록(공식/내 밸류체인) 페이지당 건수 기본값. */
export const CHAIN_LIST_PAGE_SIZE = 20;

/** 목록 조회 `limit` 쿼리 파라미터 상한(과도한 응답 크기 방지). */
export const LIST_PAGE_LIMIT_MAX = 100;
