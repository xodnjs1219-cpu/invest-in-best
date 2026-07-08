/**
 * companies(기업 상세, UC-020) 기능 에러 코드 (spec §6.3 Error Codes 그대로).
 */
export const companiesErrorCodes = {
  invalidRequest: "INVALID_REQUEST", // 400 — 파라미터 검증 실패(E15)
  companyNotFound: "COMPANY_NOT_FOUND", // 404 — 종목 마스터 미존재/미상장(E1), securityId 미존재(E13)
  tickerAmbiguous: "TICKER_AMBIGUOUS", // 409 — 동일 티커 복수 시장 + market 미지정(E4)
  companyFetchError: "COMPANY_FETCH_ERROR", // 500
  companyValidationError: "COMPANY_VALIDATION_ERROR", // 500
  financialsFetchError: "FINANCIALS_FETCH_ERROR", // 500
  financialsValidationError: "FINANCIALS_VALIDATION_ERROR", // 500
  disclosuresFetchError: "DISCLOSURES_FETCH_ERROR", // 500
  disclosuresValidationError: "DISCLOSURES_VALIDATION_ERROR", // 500
  quotesFetchError: "QUOTES_FETCH_ERROR", // 500
  quotesValidationError: "QUOTES_VALIDATION_ERROR", // 500
  chainsFetchError: "CHAINS_FETCH_ERROR", // 500
  chainsValidationError: "CHAINS_VALIDATION_ERROR", // 500
} as const;

export type CompaniesServiceError = (typeof companiesErrorCodes)[keyof typeof companiesErrorCodes];
