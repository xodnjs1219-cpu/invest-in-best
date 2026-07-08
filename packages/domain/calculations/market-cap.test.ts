import { describe, expect, it } from "vitest";
import { buildMarketCapSeries, calculateMarketCap, pickLatestShares } from "./market-cap";

describe("calculateMarketCap", () => {
  it("multiplies close price by shares outstanding", () => {
    expect(calculateMarketCap(1000, 500)).toBe(500000);
  });

  it("returns null when closePrice is null", () => {
    expect(calculateMarketCap(null, 500)).toBeNull();
  });

  it("throws on negative shares", () => {
    expect(() => calculateMarketCap(1000, -1)).toThrow(RangeError);
  });

  it("throws on negative close price", () => {
    expect(() => calculateMarketCap(-1, 500)).toThrow(RangeError);
  });
});

describe("buildMarketCapSeries", () => {
  it("일별 종가 × 최신 상장주식수로 시총 시계열을 산출한다", () => {
    const candles = [
      { tradeDate: "2026-01-02", close: 1000 },
      { tradeDate: "2026-01-03", close: 1100 },
    ];
    expect(buildMarketCapSeries(candles, 500)).toEqual([
      { tradeDate: "2026-01-02", marketCap: 500000 },
      { tradeDate: "2026-01-03", marketCap: 550000 },
    ]);
  });

  it("close: null인 캔들은 해당 일자만 marketCap: null로 반환한다(순서·길이 보존)", () => {
    const candles = [
      { tradeDate: "2026-01-02", close: 1000 },
      { tradeDate: "2026-01-03", close: null },
      { tradeDate: "2026-01-04", close: 1200 },
    ];
    const result = buildMarketCapSeries(candles, 500);
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({ tradeDate: "2026-01-03", marketCap: null });
    expect(result.at(0)?.marketCap).toBe(500000);
    expect(result.at(2)?.marketCap).toBe(600000);
  });

  it("입력 배열을 비변이한다", () => {
    const candles = [{ tradeDate: "2026-01-02", close: 1000 }];
    const original = JSON.parse(JSON.stringify(candles));
    buildMarketCapSeries(candles, 500);
    expect(candles).toEqual(original);
  });

  it("빈 배열 입력 시 빈 배열을 반환한다", () => {
    expect(buildMarketCapSeries([], 500)).toEqual([]);
  });
});

describe("pickLatestShares", () => {
  it("기준일이 상이한 2행 중 최신 asOfDate 행을 선택한다", () => {
    const rows = [
      { shares: 100, asOfDate: "2025-01-01", source: "dart" as const, isMultiClassPartial: false },
      { shares: 200, asOfDate: "2026-01-01", source: "dart" as const, isMultiClassPartial: false },
    ];
    expect(pickLatestShares(rows)).toEqual(rows[1]);
  });

  it("동일 asOfDate에 dart·toss 2행이 있으면 toss 행을 선택한다(우선순위)", () => {
    const rows = [
      { shares: 100, asOfDate: "2026-01-01", source: "dart" as const, isMultiClassPartial: false },
      { shares: 200, asOfDate: "2026-01-01", source: "toss" as const, isMultiClassPartial: false },
    ];
    expect(pickLatestShares(rows)?.source).toBe("toss");
  });

  it("동일 asOfDate에 dart·sec 2행이 있으면 dart 행을 선택한다(우선순위)", () => {
    const rows = [
      { shares: 100, asOfDate: "2026-01-01", source: "sec" as const, isMultiClassPartial: false },
      { shares: 200, asOfDate: "2026-01-01", source: "dart" as const, isMultiClassPartial: false },
    ];
    expect(pickLatestShares(rows)?.source).toBe("dart");
  });

  it("빈 배열이면 null을 반환한다(E9 — 시총 미표시 신호)", () => {
    expect(pickLatestShares([])).toBeNull();
  });

  it("isMultiClassPartial=true 행 선택 시 플래그를 보존한다", () => {
    const rows = [
      { shares: 100, asOfDate: "2026-01-01", source: "toss" as const, isMultiClassPartial: true },
    ];
    expect(pickLatestShares(rows)?.isMultiClassPartial).toBe(true);
  });
});
