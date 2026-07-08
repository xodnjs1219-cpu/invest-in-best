import { describe, expect, it } from "vitest";
import { MIN_SEARCH_QUERY_LENGTH, SEARCH_DEBOUNCE_MS, SEARCH_PAGE_SIZE } from "./search";

describe("search constants", () => {
  it("SEARCH_PAGE_SIZE는 20이다 (UC-008 spec, 결정 B-3)", () => {
    expect(SEARCH_PAGE_SIZE).toBe(20);
  });

  it("MIN_SEARCH_QUERY_LENGTH는 1이다 (결정 B-4)", () => {
    expect(MIN_SEARCH_QUERY_LENGTH).toBe(1);
  });

  it("SEARCH_DEBOUNCE_MS는 300이다 (결정 B-4)", () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });
});
