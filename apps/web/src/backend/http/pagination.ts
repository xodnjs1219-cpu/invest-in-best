import { z } from "zod";

export type PaginationQuery = {
  page: number;
  limit: number;
};

export type Pagination = {
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
};

type CreatePaginationQuerySchemaParams = {
  defaultLimit: number;
  maxLimit: number;
};

/**
 * 목록 API 공통 쿼리 스키마 팩토리 (UC-007 plan 모듈 A-4, 공통).
 * `page`: 1 이상 정수(기본 1), `limit`: 1~maxLimit 정수(기본 defaultLimit).
 * 음수·비숫자·상한 초과·소수는 파싱 실패 처리한다(spec 엣지 6의 원천).
 */
export const createPaginationQuerySchema = ({
  defaultLimit,
  maxLimit,
}: CreatePaginationQuerySchemaParams) =>
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
  });

/**
 * 페이지네이션 메타 계산(순수 함수) — `hasMore = page * limit < totalCount`.
 */
export const buildPagination = (page: number, limit: number, totalCount: number): Pagination => ({
  page,
  limit,
  totalCount,
  hasMore: page * limit < totalCount,
});
