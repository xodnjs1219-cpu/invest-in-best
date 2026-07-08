import { describe, expect, it } from "vitest";
import {
  CompanySummaryQuerySchema,
  DisclosuresQuerySchema,
  FinancialsQuerySchema,
  QuarterlyFinancialRowSchema,
  QuotesQuerySchema,
  SecurityIdParamSchema,
  TickerParamSchema,
} from "./schema";

describe("TickerParamSchema", () => {
  it("공백을 trim하고 대문자로 정규화한다", () => {
    const parsed = TickerParamSchema.safeParse({ ticker: " aapl " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ticker).toBe("AAPL");
    }
  });

  it("빈 문자열은 실패한다", () => {
    expect(TickerParamSchema.safeParse({ ticker: "" }).success).toBe(false);
  });

  it("KRX 6자리 숫자 티커는 그대로 유지된다(대문자 변환 무영향)", () => {
    const parsed = TickerParamSchema.safeParse({ ticker: "005930" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ticker).toBe("005930");
    }
  });
});

describe("CompanySummaryQuerySchema", () => {
  it("market 생략은 허용된다", () => {
    expect(CompanySummaryQuerySchema.safeParse({}).success).toBe(true);
  });

  it("market='JP'는 실패한다", () => {
    expect(CompanySummaryQuerySchema.safeParse({ market: "JP" }).success).toBe(false);
  });

  it("market='KRX'/'US'는 통과한다", () => {
    expect(CompanySummaryQuerySchema.safeParse({ market: "KRX" }).success).toBe(true);
    expect(CompanySummaryQuerySchema.safeParse({ market: "US" }).success).toBe(true);
  });
});

describe("SecurityIdParamSchema", () => {
  it("UUID가 아니면 실패한다", () => {
    expect(SecurityIdParamSchema.safeParse({ securityId: "not-a-uuid" }).success).toBe(false);
  });

  it("올바른 UUID는 통과한다", () => {
    expect(
      SecurityIdParamSchema.safeParse({ securityId: "11111111-1111-4111-8111-111111111111" }).success,
    ).toBe(true);
  });
});

describe("FinancialsQuerySchema", () => {
  it("fromYear/toYear 생략은 허용된다", () => {
    expect(FinancialsQuerySchema.safeParse({}).success).toBe(true);
  });

  it("문자열 연도를 숫자로 coerce한다", () => {
    const parsed = FinancialsQuerySchema.safeParse({ fromYear: "2020", toYear: "2024" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.fromYear).toBe(2020);
      expect(parsed.data.toYear).toBe(2024);
    }
  });
});

describe("DisclosuresQuerySchema", () => {
  it("page 미지정 시 기본값 1", () => {
    const parsed = DisclosuresQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
    }
  });

  it("page=0은 실패한다", () => {
    expect(DisclosuresQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });
});

describe("QuotesQuerySchema", () => {
  it("from/to 생략은 허용된다", () => {
    expect(QuotesQuerySchema.safeParse({}).success).toBe(true);
  });

  it("형식 오류(월 2-3)는 실패한다", () => {
    expect(QuotesQuerySchema.safeParse({ from: "2026-2-3" }).success).toBe(false);
  });

  it("실존하지 않는 날짜(2026-02-30)는 실패한다", () => {
    expect(QuotesQuerySchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
  });

  it("올바른 형식은 통과한다", () => {
    expect(QuotesQuerySchema.safeParse({ from: "2026-01-01", to: "2026-07-01" }).success).toBe(true);
  });
});

describe("QuarterlyFinancialRowSchema", () => {
  it("revenue가 문자열 numeric이면 숫자로 coerce한다", () => {
    const parsed = QuarterlyFinancialRowSchema.safeParse({
      period_type: "quarter",
      fiscal_year: 2024,
      fiscal_quarter: 1,
      calendar_year: 2024,
      calendar_quarter: 1,
      currency: "KRW",
      revenue: "1234.56",
      operating_income: "100",
      net_income: "50",
      amount_basis: "three_month",
      is_revenue_tag_unmapped: false,
      source: "dart",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.revenue).toBe(1234.56);
    }
  });

  it("revenue: null은 통과한다(태그 미매핑)", () => {
    const parsed = QuarterlyFinancialRowSchema.safeParse({
      period_type: "quarter",
      fiscal_year: 2024,
      fiscal_quarter: 1,
      calendar_year: 2024,
      calendar_quarter: 1,
      currency: "USD",
      revenue: null,
      operating_income: "100",
      net_income: "50",
      amount_basis: "three_month",
      is_revenue_tag_unmapped: true,
      source: "sec",
    });
    expect(parsed.success).toBe(true);
  });

  it("annual 행은 fiscal_quarter/amount_basis가 null이어도 통과한다", () => {
    const parsed = QuarterlyFinancialRowSchema.safeParse({
      period_type: "annual",
      fiscal_year: 2024,
      fiscal_quarter: null,
      calendar_year: null,
      calendar_quarter: null,
      currency: "USD",
      revenue: "100",
      operating_income: "10",
      net_income: "5",
      amount_basis: null,
      is_revenue_tag_unmapped: false,
      source: "sec",
    });
    expect(parsed.success).toBe(true);
  });
});
