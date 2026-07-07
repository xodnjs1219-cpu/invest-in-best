/**
 * 시가총액 계산: 일별 종가 × 최신 상장주식수.
 * 순수 함수 — 프레임워크/DB 의존성 없음 (techstack.md §4 packages/domain 원칙).
 */
export function calculateMarketCap(closePrice: number, sharesOutstanding: number): number {
  if (closePrice < 0 || sharesOutstanding < 0) {
    throw new RangeError("closePrice and sharesOutstanding must be non-negative");
  }
  return closePrice * sharesOutstanding;
}
