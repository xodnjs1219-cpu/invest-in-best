/**
 * 시가총액 계산: 일별 종가 × 최신 상장주식수 (docs/usecases/020/plan.md 모듈 2).
 * 순수 함수 — I/O·Date.now() 금지, web BE/FE·worker(UC-029) 공유 후보(techstack.md §4 packages/domain 원칙).
 */
import { SHARES_SOURCE_PRIORITY, type SharesSource } from "../constants/company-detail";

/** closePrice가 null이면 null(미확정/미수집 신호), 아니면 곱(spec §6.1 시총 산출 정책의 단일 정의). */
export function calculateMarketCap(closePrice: number | null, sharesOutstanding: number): number | null {
  if (sharesOutstanding < 0 || (closePrice !== null && closePrice < 0)) {
    throw new RangeError("closePrice and sharesOutstanding must be non-negative");
  }
  if (closePrice === null) {
    return null;
  }
  return closePrice * sharesOutstanding;
}

export type MarketCapSeriesPoint = { tradeDate: string; marketCap: number | null };

/** 거래일 순서 보존, 입력 배열 비변이 — 일별 종가 × 최신 상장주식수 시계열 산출. */
export function buildMarketCapSeries(
  candles: ReadonlyArray<{ tradeDate: string; close: number | null }>,
  shares: number,
): MarketCapSeriesPoint[] {
  return candles.map((candle) => ({
    tradeDate: candle.tradeDate,
    marketCap: calculateMarketCap(candle.close, shares),
  }));
}

export type SharesRow = {
  shares: number;
  asOfDate: string;
  source: SharesSource;
  isMultiClassPartial: boolean;
};

/**
 * 최신 상장주식수 1건 선별: ① asOfDate 최대 행들로 축소 ② 복수면 SHARES_SOURCE_PRIORITY 순으로 1건
 * ③ 빈 배열이면 null(E9 — 시총 미표시 신호).
 */
export function pickLatestShares(rows: ReadonlyArray<SharesRow>): SharesRow | null {
  const [firstRow, ...restRows] = rows;
  if (firstRow === undefined) {
    return null;
  }

  const latestAsOfDate = restRows.reduce(
    (max, row) => (row.asOfDate > max ? row.asOfDate : max),
    firstRow.asOfDate,
  );
  const latestRows = rows.filter((row) => row.asOfDate === latestAsOfDate);

  latestRows.sort(
    (a, b) => SHARES_SOURCE_PRIORITY.indexOf(a.source) - SHARES_SOURCE_PRIORITY.indexOf(b.source),
  );

  const [winner] = latestRows;
  return winner ?? null;
}
