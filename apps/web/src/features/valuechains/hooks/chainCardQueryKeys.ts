/**
 * 체인 카드 목록 쿼리 키 (UC-007 plan 모듈 D-3, state_management.md §6 계약).
 * `chain-view-query-keys.ts`(UC-009, 개별 체인 상세)와는 별개 — 이 파일은 목록(공식/내 체인) 전용이다.
 */
export const chainCardQueryKeys = {
  official: ["valuechains", "official"] as const,
  mine: ["valuechains", "mine"] as const,
};
