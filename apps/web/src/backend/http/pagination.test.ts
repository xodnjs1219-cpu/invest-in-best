import { describe, expect, it } from "vitest";
import { buildPagination, createPaginationQuerySchema } from "@/backend/http/pagination";

describe("createPaginationQuerySchema", () => {
  const schema = createPaginationQuerySchema({ defaultLimit: 20, maxLimit: 100 });

  it("파라미터 생략 시 기본값 { page:1, limit:defaultLimit }을 적용한다", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({ page: 1, limit: 20 });
  });

  it("문자열 숫자('2')를 coerce하여 성공한다", () => {
    const result = schema.safeParse({ page: "2", limit: "10" });
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({ page: 2, limit: 10 });
  });

  it("비숫자 문자열('abc')은 파싱 실패한다", () => {
    const result = schema.safeParse({ page: "abc" });
    expect(result.success).toBe(false);
  });

  it("음수 page(-1)는 파싱 실패한다", () => {
    const result = schema.safeParse({ page: "-1" });
    expect(result.success).toBe(false);
  });

  it("0은 파싱 실패한다(page는 1 이상)", () => {
    const result = schema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("소수(1.5)는 파싱 실패한다", () => {
    const result = schema.safeParse({ page: "1.5" });
    expect(result.success).toBe(false);
  });

  it("limit이 maxLimit을 초과하면 파싱 실패한다", () => {
    const result = schema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("limit이 maxLimit과 같으면 성공한다", () => {
    const result = schema.safeParse({ limit: "100" });
    expect(result.success).toBe(true);
  });
});

describe("buildPagination", () => {
  it("totalCount=0이면 hasMore=false", () => {
    expect(buildPagination(1, 20, 0)).toEqual({ page: 1, limit: 20, totalCount: 0, hasMore: false });
  });

  it("page*limit < totalCount이면 hasMore=true (1,20,21)", () => {
    expect(buildPagination(1, 20, 21)).toEqual({ page: 1, limit: 20, totalCount: 21, hasMore: true });
  });

  it("page*limit === totalCount이면 hasMore=false (2,20,40)", () => {
    expect(buildPagination(2, 20, 40)).toEqual({ page: 2, limit: 20, totalCount: 40, hasMore: false });
  });

  it("page*limit < totalCount이면 hasMore=true (2,20,41)", () => {
    expect(buildPagination(2, 20, 41)).toEqual({ page: 2, limit: 20, totalCount: 41, hasMore: true });
  });
});
