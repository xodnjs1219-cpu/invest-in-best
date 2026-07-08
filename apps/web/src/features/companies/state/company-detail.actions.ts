import type { FinancialsPeriodPreset, QuotesPeriodPreset } from "@iib/domain";

/**
 * 기업 상세(UC-020) Store Action 판별 유니온 (state_management.md §3.2).
 * 네이밍: `<도메인>_<사건(과거형)>` UPPER_SNAKE_CASE — "무슨 일이 일어났다"로 명명한다.
 */
export type CompanyDetailAction =
  | { type: "QUOTES_PERIOD_CHANGED"; payload: { period: QuotesPeriodPreset } }
  | { type: "FINANCIALS_PERIOD_CHANGED"; payload: { period: FinancialsPeriodPreset } }
  | { type: "TIMELINE_NOTICE_DISMISSED" };
