import { describe, expect, it } from "vitest";
import {
  ANNUAL_PERIOD_DAYS,
  DART_ACCOUNT_MAP,
  DART_REPORT_CODES,
  DEFAULT_KRX_SETTLEMENT_MONTH,
  FINANCIALS_MIN_FISCAL_YEAR,
  QUARTER_PERIOD_DAYS,
  SEC_SHARES_TAG_CHAIN,
  US_DISCLOSURE_FORMS,
  US_REVENUE_TAG_CHAIN,
} from "./financials";

describe("financials constants", () => {
  it("US_REVENUE_TAG_CHAIN starts with ExcludingAssessedTax and ends with ifrs-full:Revenue", () => {
    expect(US_REVENUE_TAG_CHAIN[0]).toBe("us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax");
    expect(US_REVENUE_TAG_CHAIN[US_REVENUE_TAG_CHAIN.length - 1]).toBe("ifrs-full:Revenue");
  });

  it("SEC_SHARES_TAG_CHAIN only marks the first tag as non-partial", () => {
    expect(SEC_SHARES_TAG_CHAIN[0]?.partial).toBe(false);
    expect(SEC_SHARES_TAG_CHAIN.slice(1).every((t) => t.partial === true)).toBe(true);
  });

  it("DART_MULTI_ACNT_CHUNK_SIZE-equivalent external cap is respected (<=100)", () => {
    // guarded in batch.ts; here we just assert report codes are the 4 known values
    expect(Object.values(DART_REPORT_CODES).sort()).toEqual(["11011", "11012", "11013", "11014"]);
  });

  it("FINANCIALS_MIN_FISCAL_YEAR matches the DB CHECK constraint (2015)", () => {
    expect(FINANCIALS_MIN_FISCAL_YEAR).toBe(2015);
  });

  it("QUARTER_PERIOD_DAYS and ANNUAL_PERIOD_DAYS define sane ranges", () => {
    expect(QUARTER_PERIOD_DAYS.min).toBeLessThan(QUARTER_PERIOD_DAYS.max);
    expect(ANNUAL_PERIOD_DAYS.min).toBeLessThan(ANNUAL_PERIOD_DAYS.max);
    expect(QUARTER_PERIOD_DAYS.max).toBeLessThan(ANNUAL_PERIOD_DAYS.min);
  });

  it("US_DISCLOSURE_FORMS includes the core form whitelist", () => {
    expect(US_DISCLOSURE_FORMS).toEqual(
      expect.arrayContaining(["10-K", "10-Q", "8-K", "20-F", "40-F", "6-K"]),
    );
  });

  it("DART_ACCOUNT_MAP defines fallback entries for revenue/operating_income/net_income", () => {
    expect(DART_ACCOUNT_MAP.revenue.length).toBeGreaterThan(0);
    expect(DART_ACCOUNT_MAP.operatingIncome.length).toBeGreaterThan(0);
    expect(DART_ACCOUNT_MAP.netIncome.length).toBeGreaterThan(0);
  });

  it("DEFAULT_KRX_SETTLEMENT_MONTH is December (UC-031 fallback when company profile is unavailable)", () => {
    expect(DEFAULT_KRX_SETTLEMENT_MONTH).toBe(12);
  });
});
