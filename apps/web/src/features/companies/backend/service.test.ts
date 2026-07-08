import { describe, expect, it, vi } from "vitest";
import {
  getBelongingChains,
  getCompanySummary,
  getDisclosures,
  getFinancials,
  getQuotes,
} from "@/features/companies/backend/service";
import { companiesErrorCodes } from "@/features/companies/backend/error";
import type { CompaniesRepository, RepoResult } from "@/features/companies/backend/repository";

const ok = <T>(data: T): RepoResult<T> => ({ ok: true, data });
const err = (message: string): RepoResult<never> => ({ ok: false, message });

const buildSecurityRow = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "11111111-1111-4111-8111-111111111111",
  ticker: "005930",
  name: "삼성전자",
  english_name: "Samsung Electronics",
  market: "KRX",
  currency: "KRW",
  listing_status: "listed",
  company_profiles: {
    representative_name: "대표자",
    established_date: "1969-01-13",
    homepage_url: "https://samsung.com",
    sector: "전자",
    last_collected_at: "2026-07-01T00:00:00Z",
  },
  ...overrides,
});

/** findSecurityById가 반환하는 SecurityBasicRowSchema 형태 mock(financials/quotes/disclosures/valuechains 공용). */
const buildSecurityBasicRow = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "22222222-2222-4222-8222-222222222222",
  ticker: "005930",
  market: "KRX",
  currency: "KRW",
  listing_status: "listed",
  ...overrides,
});

const createRepository = (overrides?: Partial<CompaniesRepository>): CompaniesRepository => ({
  findSecuritiesByTicker: vi.fn(async () => ok([])),
  findSecurityById: vi.fn(async () => ok(null)),
  findLatestQuoteDate: vi.fn(async () => ok(null)),
  findLatestDisclosureDate: vi.fn(async () => ok(null)),
  findQuarterlyFinancials: vi.fn(async () => ok([])),
  findDisclosures: vi.fn(async () => ok([])),
  findDailyQuotes: vi.fn(async () => ok([])),
  findRecentShares: vi.fn(async () => ok([])),
  findBelongingChains: vi.fn(async () => ok([])),
  ...overrides,
});

describe("getCompanySummary", () => {
  it("단건 매칭(KRX)이면 200 + financialSource='dart'", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () => ok([buildSecurityRow()])),
      findLatestQuoteDate: vi.fn(async () => ok("2026-07-01")),
      findLatestDisclosureDate: vi.fn(async () => ok("2026-06-01")),
    });

    const result = await getCompanySummary(repo, { ticker: "005930", market: undefined });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dataSources.financialSource).toBe("dart");
      expect(result.data.security.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(result.data.dataSources.lastQuoteDate).toBe("2026-07-01");
      expect(result.data.dataSources.lastDisclosureDate).toBe("2026-06-01");
    }
  });

  it("US 시장이면 financialSource='sec'", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () =>
        ok([buildSecurityRow({ market: "US", currency: "USD", ticker: "AAPL" })]),
      ),
    });

    const result = await getCompanySummary(repo, { ticker: "AAPL", market: "US" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dataSources.financialSource).toBe("sec");
    }
  });

  it("0행이면 404 COMPANY_NOT_FOUND(E1)", async () => {
    const repo = createRepository({ findSecuritiesByTicker: vi.fn(async () => ok([])) });

    const result = await getCompanySummary(repo, { ticker: "NOPE", market: undefined });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(companiesErrorCodes.companyNotFound);
    }
  });

  it("동일 티커 2행 + market 미지정이면 409 TICKER_AMBIGUOUS(E4)", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () =>
        ok([buildSecurityRow(), buildSecurityRow({ market: "US", currency: "USD" })]),
      ),
    });

    const result = await getCompanySummary(repo, { ticker: "005930", market: undefined });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error.code).toBe(companiesErrorCodes.tickerAmbiguous);
    }
  });

  it("동일 티커 2행이어도 market 지정 시 필터링되어(repository가 이미 필터) 단건이면 200", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () => ok([buildSecurityRow({ market: "US", currency: "USD" })])),
    });

    const result = await getCompanySummary(repo, { ticker: "005930", market: "US" });

    expect(result.ok).toBe(true);
  });

  it("company_profiles: null이면 profile: null(정형 정보 미수집)", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () => ok([buildSecurityRow({ company_profiles: null })])),
    });

    const result = await getCompanySummary(repo, { ticker: "005930", market: undefined });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.profile).toBeNull();
    }
  });

  it("listing_status='delisted'여도 200(E2 — 차단 없음)", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () => ok([buildSecurityRow({ listing_status: "delisted" })])),
    });

    const result = await getCompanySummary(repo, { ticker: "005930", market: undefined });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.security.listingStatus).toBe("delisted");
    }
  });

  it("최신 시세/공시 일자 없음이면 null로 강등한다", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () => ok([buildSecurityRow()])),
      findLatestQuoteDate: vi.fn(async () => ok(null)),
      findLatestDisclosureDate: vi.fn(async () => ok(null)),
    });

    const result = await getCompanySummary(repo, { ticker: "005930", market: undefined });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dataSources.lastQuoteDate).toBeNull();
      expect(result.data.dataSources.lastDisclosureDate).toBeNull();
    }
  });

  it("최신 시세/공시 조회가 repository 실패해도 요약 전체를 막지 않고 null로 강등한다(섹션 독립)", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () => ok([buildSecurityRow()])),
      findLatestQuoteDate: vi.fn(async () => err("quote fetch failed")),
      findLatestDisclosureDate: vi.fn(async () => err("disclosure fetch failed")),
    });

    const result = await getCompanySummary(repo, { ticker: "005930", market: undefined });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dataSources.lastQuoteDate).toBeNull();
      expect(result.data.dataSources.lastDisclosureDate).toBeNull();
    }
  });

  it("repository 실패 시 500 COMPANY_FETCH_ERROR", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () => err("db down")),
    });

    const result = await getCompanySummary(repo, { ticker: "005930", market: undefined });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(companiesErrorCodes.companyFetchError);
    }
  });

  it("Row 필드 결손 시 500 COMPANY_VALIDATION_ERROR", async () => {
    const repo = createRepository({
      findSecuritiesByTicker: vi.fn(async () => ok([{ id: "bad-row" }])),
    });

    const result = await getCompanySummary(repo, { ticker: "005930", market: undefined });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(companiesErrorCodes.companyValidationError);
    }
  });
});

describe("getFinancials", () => {
  const buildFinancialRow = (overrides?: Partial<Record<string, unknown>>) => ({
    period_type: "quarter",
    fiscal_year: 2024,
    fiscal_quarter: 1,
    calendar_year: 2024,
    calendar_quarter: 1,
    currency: "KRW",
    revenue: "1000",
    operating_income: "100",
    net_income: "50",
    amount_basis: "three_month",
    is_revenue_tag_unmapped: false,
    source: "dart",
    ...overrides,
  });

  it("securityId 미존재면 404(E13 경로 공용)", async () => {
    const repo = createRepository({ findSecurityById: vi.fn(async () => ok(null)) });

    const result = await getFinancials(repo, {
      securityId: "missing",
      query: {},
      currentYear: 2026,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("파라미터 미지정 시 기본 5Y 범위로 repository를 호출한다(toYear=currentYear, fromYear=currentYear-4)", async () => {
    const findQuarterlyFinancials = vi.fn(async () => ok([]));
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findQuarterlyFinancials,
    });

    await getFinancials(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, currentYear: 2026 });

    expect(findQuarterlyFinancials).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", 2022, 2026);
  });

  it("fromYear=2010이면 2015로 클램프한다(하한)", async () => {
    const findQuarterlyFinancials = vi.fn(async () => ok([]));
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findQuarterlyFinancials,
    });

    await getFinancials(repo, {
      securityId: "22222222-2222-4222-8222-222222222222",
      query: { fromYear: 2010 },
      currentYear: 2026,
    });

    expect(findQuarterlyFinancials).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", 2015, 2026);
  });

  it("fromYear=2026, toYear=2020이면 400 INVALID_REQUEST(E15)", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
    });

    const result = await getFinancials(repo, {
      securityId: "22222222-2222-4222-8222-222222222222",
      query: { fromYear: 2026, toYear: 2020 },
      currentYear: 2026,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(companiesErrorCodes.invalidRequest);
    }
  });

  it("빈 시계열이면 200 + items: []", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findQuarterlyFinancials: vi.fn(async () => ok([])),
    });

    const result = await getFinancials(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, currentYear: 2026 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual([]);
    }
  });

  it("is_revenue_tag_unmapped=true + revenue: null 행은 그대로 전달한다(E6 — 재계산 금지)", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "USD" }))),
      findQuarterlyFinancials: vi.fn(async () =>
        ok([buildFinancialRow({ currency: "USD", revenue: null, is_revenue_tag_unmapped: true, source: "sec" })]),
      ),
    });

    const result = await getFinancials(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, currentYear: 2026 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].revenue).toBeNull();
      expect(result.data.items[0].isRevenueTagUnmapped).toBe(true);
      expect(result.data.items[0].operatingIncome).toBe(100);
    }
  });

  it("annual 행만 존재하면 annotations.isAnnualOnly=true(E7)", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "USD" }))),
      findQuarterlyFinancials: vi.fn(async () =>
        ok([
          buildFinancialRow({
            period_type: "annual",
            fiscal_quarter: null,
            calendar_year: null,
            calendar_quarter: null,
            amount_basis: null,
          }),
        ]),
      ),
    });

    const result = await getFinancials(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, currentYear: 2026 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.annotations.isAnnualOnly).toBe(true);
    }
  });

  it("quarter 행이 섞여 있으면 isAnnualOnly=false", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findQuarterlyFinancials: vi.fn(async () => ok([buildFinancialRow()])),
    });

    const result = await getFinancials(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, currentYear: 2026 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.annotations.isAnnualOnly).toBe(false);
    }
  });

  it("빈 배열이면 isAnnualOnly=false", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findQuarterlyFinancials: vi.fn(async () => ok([])),
    });

    const result = await getFinancials(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, currentYear: 2026 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.annotations.isAnnualOnly).toBe(false);
      expect(result.data.annotations.minFiscalYear).toBe(2015);
    }
  });

  it("amount_basis='derived_from_cumulative'를 그대로 매핑한다", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findQuarterlyFinancials: vi.fn(async () =>
        ok([buildFinancialRow({ amount_basis: "derived_from_cumulative" })]),
      ),
    });

    const result = await getFinancials(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, currentYear: 2026 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].amountBasis).toBe("derived_from_cumulative");
    }
  });
});

describe("getDisclosures", () => {
  const buildDisclosureRow = (overrides?: Partial<Record<string, unknown>>) => ({
    id: "11111111-1111-4111-8111-111111111111",
    title: "정기공시",
    disclosure_date: "2026-06-01",
    url: "https://dart.fss.or.kr/x",
    source: "dart",
    ...overrides,
  });

  it("securityId 미존재면 404", async () => {
    const repo = createRepository({ findSecurityById: vi.fn(async () => ok(null)) });

    const result = await getDisclosures(repo, { securityId: "missing", page: 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("21행 반환 시 20건 + hasMore=true", async () => {
    const rows = Array.from({ length: 21 }, (_, i) =>
      buildDisclosureRow({ id: `11111111-1111-4111-8111-1111111111${String(i).padStart(2, "0")}` }),
    );
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findDisclosures: vi.fn(async () => ok(rows)),
    });

    const result = await getDisclosures(repo, { securityId: "22222222-2222-4222-8222-222222222222", page: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(20);
      expect(result.data.hasMore).toBe(true);
    }
  });

  it("5행 반환 시 hasMore=false", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => buildDisclosureRow({ id: `1111111${i}-1111-4111-8111-111111111111` }));
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findDisclosures: vi.fn(async () => ok(rows)),
    });

    const result = await getDisclosures(repo, { securityId: "22222222-2222-4222-8222-222222222222", page: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasMore).toBe(false);
    }
  });

  it("page=3이면 offset=40, limit=21로 repository를 호출한다", async () => {
    const findDisclosures = vi.fn(async () => ok([]));
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findDisclosures,
    });

    await getDisclosures(repo, { securityId: "22222222-2222-4222-8222-222222222222", page: 3 });

    expect(findDisclosures).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", 21, 40);
  });

  it("빈 배열이면 200 + items: []", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findDisclosures: vi.fn(async () => ok([])),
    });

    const result = await getDisclosures(repo, { securityId: "22222222-2222-4222-8222-222222222222", page: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual([]);
    }
  });
});

describe("getQuotes", () => {
  const buildQuoteRow = (overrides?: Partial<Record<string, unknown>>) => ({
    trade_date: "2026-07-01",
    open_price: "1000",
    high_price: "1100",
    low_price: "950",
    close_price: "1050",
    volume: "10000",
    is_closing_confirmed: true,
    ...overrides,
  });

  const buildSharesRow = (overrides?: Partial<Record<string, unknown>>) => ({
    shares: "1000000",
    as_of_date: "2026-06-01",
    source: "toss",
    is_multi_class_partial: false,
    ...overrides,
  });

  it("securityId 미존재면 404", async () => {
    const repo = createRepository({ findSecurityById: vi.fn(async () => ok(null)) });

    const result = await getQuotes(repo, {
      securityId: "missing",
      query: {},
      today: "2026-07-08",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("from/to 미지정이면 최근 1년 범위로 repository를 호출한다(C-5 준용)", async () => {
    const findDailyQuotes = vi.fn(async () => ok([]));
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findDailyQuotes,
    });

    await getQuotes(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, today: "2026-07-07" });

    expect(findDailyQuotes).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", "2025-07-07", "2026-07-07");
  });

  it("to가 미래 날짜면 today로 보정한다", async () => {
    const findDailyQuotes = vi.fn(async () => ok([]));
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findDailyQuotes,
    });

    await getQuotes(repo, {
      securityId: "22222222-2222-4222-8222-222222222222",
      query: { to: "2030-01-01" },
      today: "2026-07-07",
    });

    expect(findDailyQuotes).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", expect.any(String), "2026-07-07");
  });

  it("from이 2015 이전이면 하한으로 클램프한다", async () => {
    const findDailyQuotes = vi.fn(async () => ok([]));
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findDailyQuotes,
    });

    await getQuotes(repo, {
      securityId: "22222222-2222-4222-8222-222222222222",
      query: { from: "2010-01-01" },
      today: "2026-07-07",
    });

    expect(findDailyQuotes).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", "2015-01-01", "2026-07-07");
  });

  it("보정 후 from > to이면 400 INVALID_REQUEST(E15)", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
    });

    const result = await getQuotes(repo, {
      securityId: "22222222-2222-4222-8222-222222222222",
      query: { from: "2026-07-01", to: "2026-06-01" },
      today: "2026-07-07",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("candles: []이면 200 빈 응답(E8)", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findDailyQuotes: vi.fn(async () => ok([])),
    });

    const result = await getQuotes(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, today: "2026-07-07" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.candles).toEqual([]);
    }
  });

  it("주식수 이력이 없으면 sharesMeta: null + marketCapSeries: []", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findDailyQuotes: vi.fn(async () => ok([buildQuoteRow()])),
      findRecentShares: vi.fn(async () => ok([])),
    });

    const result = await getQuotes(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, today: "2026-07-07" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sharesMeta).toBeNull();
      expect(result.data.marketCapSeries).toEqual([]);
    }
  });

  it("주식수가 존재하면 marketCapSeries[i] = close × shares", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findDailyQuotes: vi.fn(async () => ok([buildQuoteRow({ close_price: "1000" })])),
      findRecentShares: vi.fn(async () => ok([buildSharesRow({ shares: "500" })])),
    });

    const result = await getQuotes(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, today: "2026-07-07" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.marketCapSeries[0].marketCap).toBe(500000);
      expect(result.data.sharesMeta?.shares).toBe(500);
    }
  });

  it("close: null 캔들은 marketCap: null", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findDailyQuotes: vi.fn(async () => ok([buildQuoteRow({ close_price: null, is_closing_confirmed: false })])),
      findRecentShares: vi.fn(async () => ok([buildSharesRow()])),
    });

    const result = await getQuotes(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, today: "2026-07-07" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.marketCapSeries[0].marketCap).toBeNull();
      expect(result.data.candles[0].isClosingConfirmed).toBe(false);
    }
  });

  it("동일 as_of_date 복수 소스 시 toss 우선 선택 결과가 sharesMeta에 반영된다", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow({ currency: "KRW" }))),
      findDailyQuotes: vi.fn(async () => ok([buildQuoteRow()])),
      findRecentShares: vi.fn(async () =>
        ok([
          buildSharesRow({ shares: "100", source: "dart" }),
          buildSharesRow({ shares: "200", source: "toss" }),
        ]),
      ),
    });

    const result = await getQuotes(repo, { securityId: "22222222-2222-4222-8222-222222222222", query: {}, today: "2026-07-07" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sharesMeta?.source).toBe("toss");
      expect(result.data.sharesMeta?.shares).toBe(200);
    }
  });
});

describe("getBelongingChains", () => {
  const buildChainRow = (overrides?: Partial<Record<string, unknown>>) => ({
    chain_id: "11111111-1111-4111-8111-111111111111",
    name: "반도체 체인",
    chain_type: "official",
    focus_type: "industry",
    node_count: 5,
    metric_date: null,
    total_market_cap_krw: null,
    covered_node_count: null,
    total_node_count: null,
    ...overrides,
  });

  it("securityId 미존재면 404", async () => {
    const repo = createRepository({ findSecurityById: vi.fn(async () => ok(null)) });

    const result = await getBelongingChains(repo, { securityId: "missing", currentUserId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("Guest(currentUserId=null)면 repository에 ownerId=null을 전달한다", async () => {
    const findBelongingChains = vi.fn(async () => ok([buildChainRow()]));
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findBelongingChains,
    });

    await getBelongingChains(repo, { securityId: "22222222-2222-4222-8222-222222222222", currentUserId: null });

    expect(findBelongingChains).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", null);
  });

  it("로그인 사용자면 chainType='user' 항목이 포함된다", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findBelongingChains: vi.fn(async () =>
        ok([buildChainRow({ chain_type: "user" }), buildChainRow({ chain_type: "official" })]),
      ),
    });

    const result = await getBelongingChains(repo, { securityId: "22222222-2222-4222-8222-222222222222", currentUserId: "user-1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items.some((i) => i.chainType === "user")).toBe(true);
    }
  });

  it("RPC가 user 체인을 반환했는데 currentUserId=null이면 서비스가 2차 필터로 제거한다(E12)", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findBelongingChains: vi.fn(async () => ok([buildChainRow({ chain_type: "user" })])),
    });

    const result = await getBelongingChains(repo, { securityId: "22222222-2222-4222-8222-222222222222", currentUserId: null });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual([]);
    }
  });

  it("metric_date: null이면 summary: null", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findBelongingChains: vi.fn(async () => ok([buildChainRow()])),
    });

    const result = await getBelongingChains(repo, { securityId: "22222222-2222-4222-8222-222222222222", currentUserId: null });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].summary).toBeNull();
    }
  });

  it("metric_date가 있으면 totalMarketCapKrw를 숫자로 변환한다", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findBelongingChains: vi.fn(async () =>
        ok([
          buildChainRow({
            metric_date: "2026-07-01",
            total_market_cap_krw: "1234567890",
            covered_node_count: 3,
            total_node_count: 5,
          }),
        ]),
      ),
    });

    const result = await getBelongingChains(repo, { securityId: "22222222-2222-4222-8222-222222222222", currentUserId: null });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].summary?.totalMarketCapKrw).toBe(1234567890);
      expect(result.data.items[0].summary?.metricDate).toBe("2026-07-01");
    }
  });

  it("소속 없음이면 200 + items: []", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findBelongingChains: vi.fn(async () => ok([])),
    });

    const result = await getBelongingChains(repo, { securityId: "22222222-2222-4222-8222-222222222222", currentUserId: null });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual([]);
    }
  });

  it("repository 실패 시 500 CHAINS_FETCH_ERROR", async () => {
    const repo = createRepository({
      findSecurityById: vi.fn(async () => ok(buildSecurityBasicRow())),
      findBelongingChains: vi.fn(async () => err("boom")),
    });

    const result = await getBelongingChains(repo, { securityId: "22222222-2222-4222-8222-222222222222", currentUserId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(companiesErrorCodes.chainsFetchError);
    }
  });
});
