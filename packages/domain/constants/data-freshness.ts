/**
 * 데이터 출처·수집 시각 표기 상수 (docs/usecases/009/plan.md 모듈 A7, BR-4 법적 고지 정책).
 * 밸류체인 뷰 하단 "데이터 출처 · 최종 수집 시각" 표기의 단일 SOT — 하드코딩 금지 원칙에 따라 상수화.
 */

/** 데이터 출처 표기 라벨(PRD 법적 고지 정책) — 표시 순서 고정. */
export const DATA_SOURCE_LABELS = ["금융감독원 DART", "SEC EDGAR", "토스증권"] as const;

/**
 * 최종 수집 시각 조회 대상 배치 잡 매핑(결정 C-3).
 * 키는 응답 DTO(`dataFreshness.lastCollectedAt`)의 필드명, 값은 DB enum `batch_job_type` 리터럴과 일치해야 한다(0012_batch_runs.sql).
 */
export const FRESHNESS_JOBS = {
  quotes: "collect_quotes",
  financials: "collect_financials",
  fxAndMarketHours: "collect_fx_market_hours",
} as const;

export type FreshnessJobKey = keyof typeof FRESHNESS_JOBS;
export type FreshnessJobType = (typeof FRESHNESS_JOBS)[FreshnessJobKey];
