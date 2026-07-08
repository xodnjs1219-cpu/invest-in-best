import { z } from "zod";
import { MARKETS } from "@iib/domain";

// ============================================
// Param/Query Schema (Request) — camelCase, 쿼리스트링은 문자열이므로 coerce
// ============================================

/** US 티커 대문자 정규화(SEC 마스터 표기), KRX 6자리 숫자는 무영향. */
export const TickerParamSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, "티커를 입력해 주세요.")
    .max(20)
    .transform((v) => v.toUpperCase()),
});

export type TickerParam = z.infer<typeof TickerParamSchema>;

export const CompanySummaryQuerySchema = z.object({
  market: z.enum(MARKETS).optional(),
});

export type CompanySummaryQuery = z.infer<typeof CompanySummaryQuerySchema>;

export const SecurityIdParamSchema = z.object({
  securityId: z.uuid(),
});

export type SecurityIdParam = z.infer<typeof SecurityIdParamSchema>;

/** 범위 보정·하한 클램프는 service 책임 — 여기서는 형식 오류(E15)만 검증한다. */
export const FinancialsQuerySchema = z.object({
  fromYear: z.coerce.number().int().min(1900).optional(),
  toYear: z.coerce.number().int().optional(),
});

export type FinancialsQuery = z.infer<typeof FinancialsQuerySchema>;

export const DisclosuresQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export type DisclosuresQuery = z.infer<typeof DisclosuresQuerySchema>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` 형식 + 실존 날짜(2026-02-30 등 거부) 검증. */
const isoDate = z.string().refine((raw) => {
  if (!ISO_DATE_PATTERN.test(raw)) {
    return false;
  }
  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day
  );
}, "날짜 형식이 올바르지 않습니다(YYYY-MM-DD).");

export const QuotesQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export type QuotesQuery = z.infer<typeof QuotesQuerySchema>;

// ============================================
// Database Row Schema (snake_case — 마이그레이션과 1:1)
// ============================================

export const LISTING_STATUSES = ["listed", "suspended", "delisted"] as const;
export const CURRENCIES = ["KRW", "USD"] as const;
export const FINANCIAL_SOURCES = ["dart", "sec"] as const;
export const PERIOD_TYPES = ["quarter", "annual"] as const;
export const AMOUNT_BASES = ["three_month", "derived_from_cumulative"] as const;
export const SHARES_SOURCES = ["toss", "dart", "sec"] as const;
export const CHAIN_TYPES = ["official", "user"] as const;
export const FOCUS_TYPES = ["industry", "company"] as const;

export const CompanyProfileRowSchema = z.object({
  representative_name: z.string().nullable(),
  established_date: z.string().nullable(),
  homepage_url: z.string().nullable(),
  sector: z.string().nullable(),
  last_collected_at: z.string().nullable(),
});

export const SecurityWithProfileRowSchema = z.object({
  id: z.uuid(),
  ticker: z.string(),
  name: z.string(),
  english_name: z.string().nullable(),
  market: z.enum(MARKETS),
  currency: z.enum(CURRENCIES),
  listing_status: z.enum(LISTING_STATUSES),
  company_profiles: CompanyProfileRowSchema.nullable(),
});

export type SecurityWithProfileRow = z.infer<typeof SecurityWithProfileRowSchema>;

export const SecurityBasicRowSchema = z.object({
  id: z.uuid(),
  ticker: z.string(),
  market: z.enum(MARKETS),
  currency: z.enum(CURRENCIES),
  listing_status: z.enum(LISTING_STATUSES),
});

export type SecurityBasicRow = z.infer<typeof SecurityBasicRowSchema>;

export const QuarterlyFinancialRowSchema = z.object({
  period_type: z.enum(PERIOD_TYPES),
  fiscal_year: z.coerce.number().int(),
  fiscal_quarter: z.coerce.number().int().min(1).max(4).nullable(),
  calendar_year: z.coerce.number().int().nullable(),
  calendar_quarter: z.coerce.number().int().nullable(),
  currency: z.enum(CURRENCIES),
  revenue: z.coerce.number().nullable(),
  operating_income: z.coerce.number().nullable(),
  net_income: z.coerce.number().nullable(),
  amount_basis: z.enum(AMOUNT_BASES).nullable(),
  is_revenue_tag_unmapped: z.boolean(),
  source: z.enum(FINANCIAL_SOURCES),
});

export type QuarterlyFinancialRow = z.infer<typeof QuarterlyFinancialRowSchema>;

export const DisclosureRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  disclosure_date: z.string(),
  url: z.url(),
  source: z.enum(FINANCIAL_SOURCES),
});

export type DisclosureRow = z.infer<typeof DisclosureRowSchema>;

export const DailyQuoteRowSchema = z.object({
  trade_date: z.string(),
  open_price: z.coerce.number().nullable(),
  high_price: z.coerce.number().nullable(),
  low_price: z.coerce.number().nullable(),
  close_price: z.coerce.number().nullable(),
  volume: z.coerce.number().nullable(),
  is_closing_confirmed: z.boolean(),
});

export type DailyQuoteRow = z.infer<typeof DailyQuoteRowSchema>;

export const SharesRowSchema = z.object({
  shares: z.coerce.number(),
  as_of_date: z.string(),
  source: z.enum(SHARES_SOURCES),
  is_multi_class_partial: z.boolean(),
});

export type SharesRow = z.infer<typeof SharesRowSchema>;

export const BelongingChainRpcRowSchema = z.object({
  chain_id: z.uuid(),
  name: z.string(),
  chain_type: z.enum(CHAIN_TYPES),
  focus_type: z.enum(FOCUS_TYPES),
  node_count: z.coerce.number().int(),
  metric_date: z.string().nullable(),
  total_market_cap_krw: z.string().nullable(),
  covered_node_count: z.coerce.number().int().nullable(),
  total_node_count: z.coerce.number().int().nullable(),
});

export type BelongingChainRpcRow = z.infer<typeof BelongingChainRpcRowSchema>;

// ============================================
// Response Schema (camelCase — spec §6.3의 5개 스키마 그대로)
// ============================================

export const CompanySummaryResponseSchema = z.object({
  security: z.object({
    id: z.uuid(),
    ticker: z.string(),
    name: z.string(),
    englishName: z.string().nullable(),
    market: z.enum(MARKETS),
    currency: z.enum(CURRENCIES),
    listingStatus: z.enum(LISTING_STATUSES),
  }),
  profile: z
    .object({
      representativeName: z.string().nullable(),
      establishedDate: z.string().nullable(),
      homepageUrl: z.string().nullable(),
      sector: z.string().nullable(),
      lastCollectedAt: z.string().nullable(),
    })
    .nullable(),
  dataSources: z.object({
    financialSource: z.enum(FINANCIAL_SOURCES),
    quoteSource: z.literal("toss"),
    lastQuoteDate: z.string().nullable(),
    lastDisclosureDate: z.string().nullable(),
  }),
});

export type CompanySummaryResponse = z.infer<typeof CompanySummaryResponseSchema>;

export const FinancialItemSchema = z.object({
  periodType: z.enum(PERIOD_TYPES),
  fiscalYear: z.number().int(),
  fiscalQuarter: z.number().int().nullable(),
  calendarYear: z.number().int().nullable(),
  calendarQuarter: z.number().int().nullable(),
  revenue: z.number().nullable(),
  operatingIncome: z.number().nullable(),
  netIncome: z.number().nullable(),
  amountBasis: z.enum(AMOUNT_BASES).nullable(),
  isRevenueTagUnmapped: z.boolean(),
  source: z.enum(FINANCIAL_SOURCES),
});

export type FinancialItem = z.infer<typeof FinancialItemSchema>;

export const FinancialsResponseSchema = z.object({
  securityId: z.uuid(),
  currency: z.enum(CURRENCIES),
  items: z.array(FinancialItemSchema),
  annotations: z.object({
    minFiscalYear: z.number().int(),
    isAnnualOnly: z.boolean(),
  }),
});

export type FinancialsResponse = z.infer<typeof FinancialsResponseSchema>;

export const DisclosureItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  disclosureDate: z.string(),
  url: z.url(),
  source: z.enum(FINANCIAL_SOURCES),
});

export type DisclosureItem = z.infer<typeof DisclosureItemSchema>;

export const DisclosuresResponseSchema = z.object({
  securityId: z.uuid(),
  items: z.array(DisclosureItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  hasMore: z.boolean(),
});

export type DisclosuresResponse = z.infer<typeof DisclosuresResponseSchema>;

export const CandleItemSchema = z.object({
  tradeDate: z.string(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  close: z.number().nullable(),
  volume: z.number().nullable(),
  isClosingConfirmed: z.boolean(),
});

export type CandleItem = z.infer<typeof CandleItemSchema>;

export const MarketCapPointSchema = z.object({
  tradeDate: z.string(),
  marketCap: z.number().nullable(),
});

export type MarketCapPoint = z.infer<typeof MarketCapPointSchema>;

export const SharesMetaSchema = z
  .object({
    shares: z.number(),
    asOfDate: z.string(),
    source: z.enum(SHARES_SOURCES),
    isMultiClassPartial: z.boolean(),
  })
  .nullable();

export type SharesMeta = z.infer<typeof SharesMetaSchema>;

export const QuotesResponseSchema = z.object({
  securityId: z.uuid(),
  currency: z.enum(CURRENCIES),
  candles: z.array(CandleItemSchema),
  marketCapSeries: z.array(MarketCapPointSchema),
  sharesMeta: SharesMetaSchema,
});

export type QuotesResponse = z.infer<typeof QuotesResponseSchema>;

export const ChainSummarySchema = z
  .object({
    totalMarketCapKrw: z.number().nullable(),
    coveredNodeCount: z.number().int(),
    totalNodeCount: z.number().int(),
    metricDate: z.string().nullable(),
  })
  .nullable();

export type ChainSummary = z.infer<typeof ChainSummarySchema>;

export const BelongingChainItemSchema = z.object({
  chainId: z.uuid(),
  name: z.string(),
  chainType: z.enum(CHAIN_TYPES),
  focusType: z.enum(FOCUS_TYPES),
  nodeCount: z.number().int(),
  summary: ChainSummarySchema,
});

export type BelongingChainItem = z.infer<typeof BelongingChainItemSchema>;

export const CompanyValuechainsResponseSchema = z.object({
  securityId: z.uuid(),
  items: z.array(BelongingChainItemSchema),
});

export type CompanyValuechainsResponse = z.infer<typeof CompanyValuechainsResponseSchema>;
