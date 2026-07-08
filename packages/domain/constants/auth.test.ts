import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, passwordSchema } from "./auth";

describe("passwordSchema", () => {
  it("영문+숫자 8자 이상('abcd1234')을 통과시킨다", () => {
    expect(passwordSchema.safeParse("abcd1234").success).toBe(true);
  });

  it("숫자가 없는 'abcdefgh'를 실패시킨다", () => {
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
  });

  it("영문이 없는 '12345678'을 실패시킨다", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });

  it("최소 길이 미달인 'a1b2c3'을 실패시킨다", () => {
    expect(passwordSchema.safeParse("a1b2c3").success).toBe(false);
  });
});

describe("비밀번호 정책 상수", () => {
  it("최소 길이는 8이다 (결정 A-2)", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it("PASSWORD_PATTERN이 영문+숫자 포함을 요구한다", () => {
    expect(PASSWORD_PATTERN.test("abcd1234")).toBe(true);
    expect(PASSWORD_PATTERN.test("abcdefgh")).toBe(false);
    expect(PASSWORD_PATTERN.test("12345678")).toBe(false);
  });
});
