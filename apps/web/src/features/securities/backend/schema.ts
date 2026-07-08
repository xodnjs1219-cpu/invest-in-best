import { z } from "zod";
import { MARKETS } from "@iib/domain";

// ============================================
// Request (Query) Schema (camelCase — 쿼리스트링은 문자열이므로 coerce)
// ============================================

/**
 * 검색 쿼리 스키마. `q`는 원본 존재(최소 1자)만 검증한다 —
 * 정규화·최소 길이 재검증은 service 책임(spec 시퀀스: Router는 형식만, Service가 정규화).
 */
export const SecuritySearchQuerySchema = z.object({
  q: z.string().min(1, "검색어를 입력해 주세요."),
  market: z.enum(MARKETS).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type SecuritySearchQuery = z.infer<typeof SecuritySearchQuerySchema>;

// ============================================
// Database Row Schema (snake_case — RPC search_securities 반환 컬럼과 1:1)
// ============================================

export const LISTING_STATUSES = ["listed", "suspended", "delisted"] as const;

export const SecuritySearchRowSchema = z.object({
  id: z.uuid(),
  ticker: z.string(),
  name: z.string(),
  english_name: z.string().nullable(),
  market: z.enum(MARKETS),
  listing_status: z.enum(LISTING_STATUSES),
});

export type SecuritySearchRow = z.infer<typeof SecuritySearchRowSchema>;

// ============================================
// Response Schema (camelCase)
// ============================================

/**
 * 검색 결과 항목. `listingStatus`는 spec Response Schema에는 없으나
 * 결정 B-5(폐지/정지 종목 노출 + 상태 배지)에 따라 추가한다(000_decisions.md가 spec에 우선).
 */
export const SecuritySearchItemSchema = z.object({
  id: z.uuid(),
  ticker: z.string(),
  name: z.string(),
  englishName: z.string().nullable(),
  market: z.enum(MARKETS),
  listingStatus: z.enum(LISTING_STATUSES),
});

export type SecuritySearchItem = z.infer<typeof SecuritySearchItemSchema>;

export const SecuritySearchResponseSchema = z.object({
  items: z.array(SecuritySearchItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  hasMore: z.boolean(),
});

export type SecuritySearchResponse = z.infer<typeof SecuritySearchResponseSchema>;
