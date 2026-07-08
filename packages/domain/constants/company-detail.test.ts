import { describe, expect, it } from "vitest";
import {
  DISCLOSURES_PAGE_SIZE,
  FINANCIALS_DEFAULT_PERIOD,
  FINANCIALS_PERIOD_PRESETS,
  FINANCIALS_PRESET_YEARS,
  QUOTES_DEFAULT_PERIOD,
  QUOTES_PERIOD_PRESETS,
  SHARES_LOOKUP_LIMIT,
  SHARES_SOURCE_PRIORITY,
  TIMESERIES_MIN_START_YEAR,
} from "./company-detail";
import { METRICS_RANGE_PRESETS, TIMESERIES_MIN_CALENDAR_YEAR } from "./metrics";

describe("company-detail 상수 (UC-020 plan 모듈 1)", () => {
  it("QUOTES_PERIOD_PRESETS는 METRICS_RANGE_PRESETS와 동일 참조다(SOT 이원화 금지)", () => {
    expect(QUOTES_PERIOD_PRESETS).toBe(METRICS_RANGE_PRESETS);
  });

  it("QUOTES_DEFAULT_PERIOD는 '1Y'다(C-5 준용)", () => {
    expect(QUOTES_DEFAULT_PERIOD).toBe("1Y");
  });

  it("FINANCIALS_PERIOD_PRESETS는 3Y/5Y/10Y/ALL 4종이다", () => {
    expect(FINANCIALS_PERIOD_PRESETS).toEqual(["3Y", "5Y", "10Y", "ALL"]);
  });

  it("FINANCIALS_DEFAULT_PERIOD는 '5Y'다", () => {
    expect(FINANCIALS_DEFAULT_PERIOD).toBe("5Y");
  });

  it("FINANCIALS_PRESET_YEARS가 3Y/5Y/10Y 각각 연수를 매핑한다", () => {
    expect(FINANCIALS_PRESET_YEARS).toEqual({ "3Y": 3, "5Y": 5, "10Y": 10 });
  });

  it("TIMESERIES_MIN_START_YEAR는 TIMESERIES_MIN_CALENDAR_YEAR(2015)를 재수출한다(SOT 이원화 금지)", () => {
    expect(TIMESERIES_MIN_START_YEAR).toBe(TIMESERIES_MIN_CALENDAR_YEAR);
    expect(TIMESERIES_MIN_START_YEAR).toBe(2015);
  });

  it("DISCLOSURES_PAGE_SIZE는 20이다", () => {
    expect(DISCLOSURES_PAGE_SIZE).toBe(20);
  });

  it("SHARES_SOURCE_PRIORITY는 toss > dart > sec 순서다", () => {
    expect(SHARES_SOURCE_PRIORITY).toEqual(["toss", "dart", "sec"]);
  });

  it("SHARES_LOOKUP_LIMIT는 5다", () => {
    expect(SHARES_LOOKUP_LIMIT).toBe(5);
  });
});
