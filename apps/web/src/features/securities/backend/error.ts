/**
 * securities(통합 종목 검색, UC-008) 기능 에러 코드 (spec Error Codes 그대로).
 */
export const securitiesSearchErrorCodes = {
  invalidQuery: "INVALID_QUERY", // 400 — 검색어 누락/최소 길이 미만, market/page Zod 검증 실패
  searchFailed: "SEARCH_FAILED", // 500 — DB 조회 실패(종목 마스터 장애 포함)
  validationError: "SEARCH_VALIDATION_ERROR", // 500 — Row/DTO 응답 스키마 검증 실패
  tooManyRequests: "TOO_MANY_REQUESTS", // 429 — 결정 B-7: MVP 미사용, 예약만(FE 오류 매핑 방어적 포함)
} as const;

export type SecuritiesSearchServiceError =
  (typeof securitiesSearchErrorCodes)[keyof typeof securitiesSearchErrorCodes];
