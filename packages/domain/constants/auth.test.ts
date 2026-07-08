import { describe, expect, it } from "vitest";
import {
  NEW_USER_DETECTION_WINDOW_SECONDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_RESET_DAILY_LIMIT,
  PASSWORD_RESET_REDIRECT_PATH,
  PASSWORD_RESET_RESEND_INTERVAL_SECONDS,
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  SUPPORTED_OAUTH_PROVIDERS,
  passwordSchema,
} from "./auth";

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

describe("OAuth 상수 (UC-003)", () => {
  it("SUPPORTED_OAUTH_PROVIDERS는 google만 포함한다 (BR-8)", () => {
    expect(SUPPORTED_OAUTH_PROVIDERS).toEqual(["google"]);
  });

  it("NEW_USER_DETECTION_WINDOW_SECONDS는 양수다", () => {
    expect(NEW_USER_DETECTION_WINDOW_SECONDS).toBeGreaterThan(0);
  });
});

describe("비밀번호 재설정 상수 (UC-004)", () => {
  it("토큰 TTL은 3600초다 (BR-2)", () => {
    expect(PASSWORD_RESET_TOKEN_TTL_SECONDS).toBe(3600);
  });

  it("재발송 최소 간격은 60초다 (BR-3)", () => {
    expect(PASSWORD_RESET_RESEND_INTERVAL_SECONDS).toBe(60);
  });

  it("일 5회 한도 상수가 정의되어 있다 (A-9: MVP 미사용, 2단계 예약)", () => {
    expect(PASSWORD_RESET_DAILY_LIMIT).toBe(5);
  });

  it("리다이렉트 경로는 /auth/reset-password다 (BR-7)", () => {
    expect(PASSWORD_RESET_REDIRECT_PATH).toBe("/auth/reset-password");
  });
});
