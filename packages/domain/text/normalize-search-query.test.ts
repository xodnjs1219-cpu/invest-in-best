import { describe, expect, it } from "vitest";
import { normalizeSearchQuery } from "./normalize-search-query";

describe("normalizeSearchQuery", () => {
  it("앞뒤 공백을 제거한다", () => {
    expect(normalizeSearchQuery("  삼성전자  ")).toBe("삼성전자");
  });

  it("전각 공백+전각 영문을 반각으로 정규화한다", () => {
    expect(normalizeSearchQuery("　ＳＡＭＳＵＮＧ　")).toBe("SAMSUNG");
  });

  it("공백만 입력하면 빈 문자열을 반환한다", () => {
    expect(normalizeSearchQuery("   ")).toBe("");
  });

  it("대소문자를 보존한다(소문자화하지 않음)", () => {
    expect(normalizeSearchQuery("AAPL")).toBe("AAPL");
  });

  it("빈 문자열은 빈 문자열을 반환한다", () => {
    expect(normalizeSearchQuery("")).toBe("");
  });
});
