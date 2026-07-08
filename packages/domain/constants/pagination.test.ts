import { describe, expect, it } from "vitest";
import { CHAIN_LIST_PAGE_SIZE, LIST_PAGE_LIMIT_MAX } from "./pagination";

describe("pagination 상수 (UC-007)", () => {
  it("CHAIN_LIST_PAGE_SIZE는 20이다(결정 B-3)", () => {
    expect(CHAIN_LIST_PAGE_SIZE).toBe(20);
  });

  it("LIST_PAGE_LIMIT_MAX는 100이다(limit 쿼리 상한)", () => {
    expect(LIST_PAGE_LIMIT_MAX).toBe(100);
  });

  it("CHAIN_LIST_PAGE_SIZE는 LIST_PAGE_LIMIT_MAX를 초과하지 않는다", () => {
    expect(CHAIN_LIST_PAGE_SIZE).toBeLessThanOrEqual(LIST_PAGE_LIMIT_MAX);
  });
});
