import {
  buildMarketCapSeries,
  FINANCIALS_DEFAULT_PERIOD,
  FINANCIALS_PRESET_YEARS,
  pickLatestShares,
  presetToDailyRange,
  resolveDailyMetricsRange,
  TIMESERIES_MIN_START_YEAR,
  type IsoDate,
  type MarketCode,
} from "@iib/domain";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import { companiesErrorCodes, type CompaniesServiceError } from "@/features/companies/backend/error";
import type { CompaniesRepository } from "@/features/companies/backend/repository";
import {
  BelongingChainRpcRowSchema,
  CompanySummaryResponseSchema,
  CompanyValuechainsResponseSchema,
  DailyQuoteRowSchema,
  DisclosureRowSchema,
  DisclosuresResponseSchema,
  FinancialsResponseSchema,
  QuarterlyFinancialRowSchema,
  QuotesResponseSchema,
  SecurityBasicRowSchema,
  SecurityWithProfileRowSchema,
  SharesRowSchema,
  type CompanySummaryResponse,
  type CompanyValuechainsResponse,
  type DisclosuresResponse,
  type FinancialsQuery,
  type FinancialsResponse,
  type QuotesQuery,
  type QuotesResponse,
} from "@/features/companies/backend/schema";

type ServiceResult<T> = HandlerResult<T, CompaniesServiceError, unknown>;

const DISCLOSURES_PAGE_SIZE = 20;

// ============================================
// (1) getCompanySummary
// ============================================

export const getCompanySummary = async (
  repo: CompaniesRepository,
  input: { ticker: string; market: MarketCode | undefined },
): Promise<ServiceResult<CompanySummaryResponse>> => {
  const repoResult = await repo.findSecuritiesByTicker(input.ticker, input.market ?? null);
  if (!repoResult.ok) {
    return failure(500, companiesErrorCodes.companyFetchError, repoResult.message);
  }

  if (repoResult.data.length === 0) {
    return failure(404, companiesErrorCodes.companyNotFound, "해당 티커의 기업을 찾을 수 없습니다.");
  }

  if (repoResult.data.length > 1 && !input.market) {
    return failure(
      409,
      companiesErrorCodes.tickerAmbiguous,
      "동일 티커가 복수 시장에 존재합니다. market 파라미터로 시장을 지정해 주세요.",
    );
  }

  const parsedRow = SecurityWithProfileRowSchema.safeParse(repoResult.data[0]);
  if (!parsedRow.success) {
    return failure(
      500,
      companiesErrorCodes.companyValidationError,
      "기업 정보 데이터 형식이 올바르지 않습니다.",
      parsedRow.error.format(),
    );
  }
  const row = parsedRow.data;

  // 최신 시세/공시 일자 조회는 메타 성격 — 실패해도 요약 전체를 막지 않고 null로 강등(섹션 독립 원칙).
  const [quoteDateResult, disclosureDateResult] = await Promise.all([
    repo.findLatestQuoteDate(row.id),
    repo.findLatestDisclosureDate(row.id),
  ]);

  const lastQuoteDate = quoteDateResult.ok ? quoteDateResult.data : null;
  const lastDisclosureDate = disclosureDateResult.ok ? disclosureDateResult.data : null;

  const parsedResponse = CompanySummaryResponseSchema.safeParse({
    security: {
      id: row.id,
      ticker: row.ticker,
      name: row.name,
      englishName: row.english_name,
      market: row.market,
      currency: row.currency,
      listingStatus: row.listing_status,
    },
    profile: row.company_profiles
      ? {
          representativeName: row.company_profiles.representative_name,
          establishedDate: row.company_profiles.established_date,
          homepageUrl: row.company_profiles.homepage_url,
          sector: row.company_profiles.sector,
          lastCollectedAt: row.company_profiles.last_collected_at,
        }
      : null,
    dataSources: {
      financialSource: row.market === "KRX" ? "dart" : "sec",
      quoteSource: "toss",
      lastQuoteDate,
      lastDisclosureDate,
    },
  });

  if (!parsedResponse.success) {
    return failure(
      500,
      companiesErrorCodes.companyValidationError,
      "기업 요약 응답 데이터 형식이 올바르지 않습니다.",
      parsedResponse.error.format(),
    );
  }

  return success(parsedResponse.data);
};

// ============================================
// (2) getFinancials
// ============================================

export const getFinancials = async (
  repo: CompaniesRepository,
  input: { securityId: string; query: FinancialsQuery; currentYear: number },
): Promise<ServiceResult<FinancialsResponse>> => {
  const securityResult = await repo.findSecurityById(input.securityId);
  if (!securityResult.ok) {
    return failure(500, companiesErrorCodes.companyFetchError, securityResult.message);
  }
  if (!securityResult.data) {
    return failure(404, companiesErrorCodes.companyNotFound, "해당 종목을 찾을 수 없습니다.");
  }
  const security = SecurityBasicRowSchema.safeParse(securityResult.data);
  if (!security.success) {
    return failure(
      500,
      companiesErrorCodes.companyValidationError,
      "종목 데이터 형식이 올바르지 않습니다.",
      security.error.format(),
    );
  }

  const toYear = input.query.toYear ?? input.currentYear;
  const defaultYears = FINANCIALS_PRESET_YEARS[FINANCIALS_DEFAULT_PERIOD];
  let fromYear = input.query.fromYear ?? toYear - defaultYears + 1;
  if (fromYear < TIMESERIES_MIN_START_YEAR) {
    fromYear = TIMESERIES_MIN_START_YEAR;
  }

  if (fromYear > toYear) {
    return failure(400, companiesErrorCodes.invalidRequest, "조회 시작 연도가 종료 연도보다 클 수 없습니다.");
  }

  const financialsResult = await repo.findQuarterlyFinancials(input.securityId, fromYear, toYear);
  if (!financialsResult.ok) {
    return failure(500, companiesErrorCodes.financialsFetchError, financialsResult.message);
  }

  const items: FinancialsResponse["items"] = [];
  let firstRowCurrency: "KRW" | "USD" | null = null;
  for (const rawRow of financialsResult.data) {
    const parsedRow = QuarterlyFinancialRowSchema.safeParse(rawRow);
    if (!parsedRow.success) {
      return failure(
        500,
        companiesErrorCodes.financialsValidationError,
        "재무 데이터 형식이 올바르지 않습니다.",
        parsedRow.error.format(),
      );
    }
    const row = parsedRow.data;
    firstRowCurrency ??= row.currency;
    items.push({
      periodType: row.period_type,
      fiscalYear: row.fiscal_year,
      fiscalQuarter: row.fiscal_quarter,
      calendarYear: row.calendar_year,
      calendarQuarter: row.calendar_quarter,
      revenue: row.revenue,
      operatingIncome: row.operating_income,
      netIncome: row.net_income,
      amountBasis: row.amount_basis,
      isRevenueTagUnmapped: row.is_revenue_tag_unmapped,
      source: row.source,
    });
  }

  // 첫 행의 보고 통화 우선, 없으면 securities.currency 폴백(database.md Open Question 3, MVP 단일 값).
  const currency = firstRowCurrency ?? security.data.currency;

  const isAnnualOnly = items.length > 0 && items.every((item) => item.periodType === "annual");

  const parsedResponse = FinancialsResponseSchema.safeParse({
    securityId: input.securityId,
    currency,
    items,
    annotations: {
      minFiscalYear: TIMESERIES_MIN_START_YEAR,
      isAnnualOnly,
    },
  });

  if (!parsedResponse.success) {
    return failure(
      500,
      companiesErrorCodes.financialsValidationError,
      "재무 응답 데이터 형식이 올바르지 않습니다.",
      parsedResponse.error.format(),
    );
  }

  return success(parsedResponse.data);
};

// ============================================
// (3) getDisclosures
// ============================================

export const getDisclosures = async (
  repo: CompaniesRepository,
  input: { securityId: string; page: number },
): Promise<ServiceResult<DisclosuresResponse>> => {
  const securityResult = await repo.findSecurityById(input.securityId);
  if (!securityResult.ok) {
    return failure(500, companiesErrorCodes.companyFetchError, securityResult.message);
  }
  if (!securityResult.data) {
    return failure(404, companiesErrorCodes.companyNotFound, "해당 종목을 찾을 수 없습니다.");
  }

  const offset = (input.page - 1) * DISCLOSURES_PAGE_SIZE;
  const limit = DISCLOSURES_PAGE_SIZE + 1;

  const disclosuresResult = await repo.findDisclosures(input.securityId, limit, offset);
  if (!disclosuresResult.ok) {
    return failure(500, companiesErrorCodes.disclosuresFetchError, disclosuresResult.message);
  }

  const hasMore = disclosuresResult.data.length > DISCLOSURES_PAGE_SIZE;
  const pageRows = hasMore
    ? disclosuresResult.data.slice(0, DISCLOSURES_PAGE_SIZE)
    : disclosuresResult.data;

  const items: DisclosuresResponse["items"] = [];
  for (const rawRow of pageRows) {
    const parsedRow = DisclosureRowSchema.safeParse(rawRow);
    if (!parsedRow.success) {
      return failure(
        500,
        companiesErrorCodes.disclosuresValidationError,
        "공시 데이터 형식이 올바르지 않습니다.",
        parsedRow.error.format(),
      );
    }
    const row = parsedRow.data;
    items.push({
      id: row.id,
      title: row.title,
      disclosureDate: row.disclosure_date,
      url: row.url,
      source: row.source,
    });
  }

  const parsedResponse = DisclosuresResponseSchema.safeParse({
    securityId: input.securityId,
    items,
    page: input.page,
    pageSize: DISCLOSURES_PAGE_SIZE,
    hasMore,
  });

  if (!parsedResponse.success) {
    return failure(
      500,
      companiesErrorCodes.disclosuresValidationError,
      "공시 응답 데이터 형식이 올바르지 않습니다.",
      parsedResponse.error.format(),
    );
  }

  return success(parsedResponse.data);
};

// ============================================
// (4) getQuotes
// ============================================

export const getQuotes = async (
  repo: CompaniesRepository,
  input: { securityId: string; query: QuotesQuery; today: string },
): Promise<ServiceResult<QuotesResponse>> => {
  const securityResult = await repo.findSecurityById(input.securityId);
  if (!securityResult.ok) {
    return failure(500, companiesErrorCodes.companyFetchError, securityResult.message);
  }
  if (!securityResult.data) {
    return failure(404, companiesErrorCodes.companyNotFound, "해당 종목을 찾을 수 없습니다.");
  }
  const security = SecurityBasicRowSchema.safeParse(securityResult.data);
  if (!security.success) {
    return failure(
      500,
      companiesErrorCodes.companyValidationError,
      "종목 데이터 형식이 올바르지 않습니다.",
      security.error.format(),
    );
  }

  const today = input.today as IsoDate;
  const from = input.query.from ?? presetToDailyRange("1Y", today).from;
  const to = input.query.to ?? today;

  const resolution = resolveDailyMetricsRange({ from, to, today });
  if (!resolution.ok) {
    return failure(400, companiesErrorCodes.invalidRequest, "조회 기간이 올바르지 않습니다(from > to).");
  }

  const [quotesResult, sharesResult] = await Promise.all([
    repo.findDailyQuotes(input.securityId, resolution.from, resolution.to),
    repo.findRecentShares(input.securityId, 5),
  ]);

  if (!quotesResult.ok) {
    return failure(500, companiesErrorCodes.quotesFetchError, quotesResult.message);
  }

  const candles: QuotesResponse["candles"] = [];
  for (const rawRow of quotesResult.data) {
    const parsedRow = DailyQuoteRowSchema.safeParse(rawRow);
    if (!parsedRow.success) {
      return failure(
        500,
        companiesErrorCodes.quotesValidationError,
        "시세 데이터 형식이 올바르지 않습니다.",
        parsedRow.error.format(),
      );
    }
    const row = parsedRow.data;
    candles.push({
      tradeDate: row.trade_date,
      open: row.open_price,
      high: row.high_price,
      low: row.low_price,
      close: row.close_price,
      volume: row.volume,
      isClosingConfirmed: row.is_closing_confirmed,
    });
  }

  let sharesMeta: QuotesResponse["sharesMeta"] = null;
  let marketCapSeries: QuotesResponse["marketCapSeries"] = [];

  if (sharesResult.ok) {
    const parsedSharesRows = [];
    for (const rawRow of sharesResult.data) {
      const parsedRow = SharesRowSchema.safeParse(rawRow);
      if (!parsedRow.success) {
        return failure(
          500,
          companiesErrorCodes.quotesValidationError,
          "상장주식수 데이터 형식이 올바르지 않습니다.",
          parsedRow.error.format(),
        );
      }
      parsedSharesRows.push({
        shares: parsedRow.data.shares,
        asOfDate: parsedRow.data.as_of_date,
        source: parsedRow.data.source,
        isMultiClassPartial: parsedRow.data.is_multi_class_partial,
      });
    }

    const latestShares = pickLatestShares(parsedSharesRows);
    if (latestShares) {
      sharesMeta = latestShares;
      marketCapSeries = buildMarketCapSeries(
        candles.map((c) => ({ tradeDate: c.tradeDate, close: c.close })),
        latestShares.shares,
      );
    }
  }

  const parsedResponse = QuotesResponseSchema.safeParse({
    securityId: input.securityId,
    currency: security.data.currency,
    candles,
    marketCapSeries,
    sharesMeta,
  });

  if (!parsedResponse.success) {
    return failure(
      500,
      companiesErrorCodes.quotesValidationError,
      "시세 응답 데이터 형식이 올바르지 않습니다.",
      parsedResponse.error.format(),
    );
  }

  return success(parsedResponse.data);
};

// ============================================
// (5) getBelongingChains
// ============================================

export const getBelongingChains = async (
  repo: CompaniesRepository,
  input: { securityId: string; currentUserId: string | null },
): Promise<ServiceResult<CompanyValuechainsResponse>> => {
  const securityResult = await repo.findSecurityById(input.securityId);
  if (!securityResult.ok) {
    return failure(500, companiesErrorCodes.companyFetchError, securityResult.message);
  }
  if (!securityResult.data) {
    return failure(404, companiesErrorCodes.companyNotFound, "해당 종목을 찾을 수 없습니다.");
  }

  const chainsResult = await repo.findBelongingChains(input.securityId, input.currentUserId);
  if (!chainsResult.ok) {
    return failure(500, companiesErrorCodes.chainsFetchError, chainsResult.message);
  }

  const items: CompanyValuechainsResponse["items"] = [];
  for (const rawRow of chainsResult.data) {
    const parsedRow = BelongingChainRpcRowSchema.safeParse(rawRow);
    if (!parsedRow.success) {
      return failure(
        500,
        companiesErrorCodes.chainsValidationError,
        "소속 체인 데이터 형식이 올바르지 않습니다.",
        parsedRow.error.format(),
      );
    }
    const row = parsedRow.data;

    // 2차 방어 필터(E12) — RPC가 SQL 필터를 우회해 user 체인을 반환해도 비로그인이면 제거.
    if (row.chain_type === "user" && input.currentUserId === null) {
      continue;
    }

    items.push({
      chainId: row.chain_id,
      name: row.name,
      chainType: row.chain_type,
      focusType: row.focus_type,
      nodeCount: row.node_count,
      summary:
        row.metric_date === null
          ? null
          : {
              totalMarketCapKrw: row.total_market_cap_krw === null ? null : Number(row.total_market_cap_krw),
              coveredNodeCount: row.covered_node_count ?? 0,
              totalNodeCount: row.total_node_count ?? 0,
              metricDate: row.metric_date,
            },
    });
  }

  const parsedResponse = CompanyValuechainsResponseSchema.safeParse({
    securityId: input.securityId,
    items,
  });

  if (!parsedResponse.success) {
    return failure(
      500,
      companiesErrorCodes.chainsValidationError,
      "소속 체인 응답 데이터 형식이 올바르지 않습니다.",
      parsedResponse.error.format(),
    );
  }

  return success(parsedResponse.data);
};
