import { MIN_SEARCH_QUERY_LENGTH, SEARCH_PAGE_SIZE, normalizeSearchQuery } from "@iib/domain";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import { securitiesSearchErrorCodes, type SecuritiesSearchServiceError } from "@/features/securities/backend/error";
import type { SecuritiesSearchRepository } from "@/features/securities/backend/repository";
import {
  SecuritySearchResponseSchema,
  SecuritySearchRowSchema,
  type SecuritySearchQuery,
  type SecuritySearchResponse,
} from "@/features/securities/backend/schema";

/**
 * UC-008 통합 종목 검색 비즈니스 로직 — repository 인터페이스에만 의존한다(Supabase 쿼리 문법 비의존).
 * 처리 순서: 정규화 → 최소길이 재검증 → 조회(limit=pageSize+1) → hasMore 산출 →
 * Row 검증 → DTO 변환(snake_case→camelCase) → 응답 스키마 검증.
 * 조회 전용(SELECT) — 사이드이펙트 없음. 로깅은 route 책임.
 */
export const searchSecurities = async (
  repository: SecuritiesSearchRepository,
  input: SecuritySearchQuery,
): Promise<HandlerResult<SecuritySearchResponse, SecuritiesSearchServiceError, unknown>> => {
  const normalizedQuery = normalizeSearchQuery(input.q);

  if (normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
    return failure(
      400,
      securitiesSearchErrorCodes.invalidQuery,
      `검색어는 최소 ${MIN_SEARCH_QUERY_LENGTH}자 이상이어야 합니다.`,
    );
  }

  const offset = (input.page - 1) * SEARCH_PAGE_SIZE;
  const limit = SEARCH_PAGE_SIZE + 1;

  const repositoryResult = await repository.searchByText({
    query: normalizedQuery,
    market: input.market ?? null,
    limit,
    offset,
  });

  if (!repositoryResult.ok) {
    return failure(500, securitiesSearchErrorCodes.searchFailed, repositoryResult.message);
  }

  const hasMore = repositoryResult.rows.length > SEARCH_PAGE_SIZE;
  const pageRows = hasMore
    ? repositoryResult.rows.slice(0, SEARCH_PAGE_SIZE)
    : repositoryResult.rows;

  const items: SecuritySearchResponse["items"] = [];
  for (const rawRow of pageRows) {
    const parsedRow = SecuritySearchRowSchema.safeParse(rawRow);
    if (!parsedRow.success) {
      return failure(
        500,
        securitiesSearchErrorCodes.validationError,
        "종목 검색 결과 데이터 형식이 올바르지 않습니다.",
        parsedRow.error.format(),
      );
    }

    const row = parsedRow.data;
    items.push({
      id: row.id,
      ticker: row.ticker,
      name: row.name,
      englishName: row.english_name,
      market: row.market,
      listingStatus: row.listing_status,
    });
  }

  const parsedResponse = SecuritySearchResponseSchema.safeParse({
    items,
    page: input.page,
    pageSize: SEARCH_PAGE_SIZE,
    hasMore,
  });

  if (!parsedResponse.success) {
    return failure(
      500,
      securitiesSearchErrorCodes.validationError,
      "종목 검색 응답 데이터 형식이 올바르지 않습니다.",
      parsedResponse.error.format(),
    );
  }

  return success(parsedResponse.data);
};
