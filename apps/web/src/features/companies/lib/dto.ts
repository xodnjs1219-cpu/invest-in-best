/**
 * FE 경계 모듈 — backend `schema.ts`의 타입만 재수출한다.
 * FE 컴포넌트·훅은 이 모듈을 통해서만 타입을 참조하고 backend 디렉토리 경로에 직접 의존하지 않는다.
 * 런타임 코드 없음(타입 전용 재수출).
 */
export type {
  BelongingChainItem,
  CandleItem,
  ChainSummary,
  CompanySummaryResponse,
  CompanyValuechainsResponse,
  DisclosureItem,
  FinancialItem,
  FinancialsResponse,
  DisclosuresResponse,
  MarketCapPoint,
  QuotesResponse,
  SharesMeta,
} from "@/features/companies/backend/schema";
