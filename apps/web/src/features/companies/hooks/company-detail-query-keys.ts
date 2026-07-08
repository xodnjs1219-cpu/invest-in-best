/**
 * 기업 상세(UC-020) 쿼리 키 팩토리 (state_management.md §5 키 규약 고정).
 * reducer 파생값(기간 등)이 키에 들어가는 지점 — 상태 변경이 재조회로 이어지는 유일한 연결 고리.
 */
export const companyDetailQueryKeys = {
  summary: (ticker: string, market: "KRX" | "US" | null) =>
    ["companies", ticker, { market }] as const,
  financials: (securityId: string, range: { fromYear: number; toYear: number }) =>
    ["securities", securityId, "financials", range.fromYear, range.toYear] as const,
  disclosures: (securityId: string) => ["securities", securityId, "disclosures"] as const,
  quotes: (securityId: string, range: { from: string; to: string }) =>
    ["securities", securityId, "quotes", range.from, range.to] as const,
  valuechains: (securityId: string) => ["securities", securityId, "valuechains"] as const,
};
