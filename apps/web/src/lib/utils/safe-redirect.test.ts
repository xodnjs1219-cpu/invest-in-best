import { describe, expect, it } from "vitest";
import { sanitizeReturnTo } from "@/lib/utils/safe-redirect";

describe("sanitizeReturnTo", () => {
  it("내부 상대 경로 '/chains/new'는 그대로 반환한다", () => {
    expect(sanitizeReturnTo("/chains/new")).toBe("/chains/new");
  });

  it("쿼리스트링 포함 내부 경로 '/a?b=1'은 그대로 반환한다", () => {
    expect(sanitizeReturnTo("/a?b=1")).toBe("/a?b=1");
  });

  it("절대 URL·프로토콜 상대·스킴 경로는 fallback '/'로 대체한다", () => {
    expect(sanitizeReturnTo("https://evil.com")).toBe("/");
    expect(sanitizeReturnTo("//evil.com")).toBe("/");
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/");
  });

  it("백슬래시가 포함된 경로는 fallback으로 대체한다", () => {
    expect(sanitizeReturnTo("/\\evil.com")).toBe("/");
    expect(sanitizeReturnTo("\\evil.com")).toBe("/");
  });

  it("null/빈 문자열/undefined는 fallback을 반환한다", () => {
    expect(sanitizeReturnTo(null)).toBe("/");
    expect(sanitizeReturnTo("")).toBe("/");
    expect(sanitizeReturnTo(undefined)).toBe("/");
  });

  it("커스텀 fallback을 지원한다", () => {
    expect(sanitizeReturnTo(null, "/home")).toBe("/home");
  });
});
