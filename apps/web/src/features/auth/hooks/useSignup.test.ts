import { describe, expect, it } from "vitest";
import { signupErrorMessage } from "@/features/auth/hooks/useSignup";
import { AUTH_SIGNUP_MESSAGES } from "@/features/auth/constants";
import { ApiError } from "@/lib/http/api-client";

describe("signupErrorMessage", () => {
  it("AUTH_RATE_LIMITED는 대기 안내 문구를 반환한다", () => {
    const error = new ApiError("AUTH_RATE_LIMITED", 429, "rate limited");
    expect(signupErrorMessage(error)).toBe(AUTH_SIGNUP_MESSAGES.rateLimited);
  });

  it("AUTH_SIGNUP_FAILED / AUTH_TERMS_SAVE_FAILED는 재시도 유도 문구를 반환한다", () => {
    expect(signupErrorMessage(new ApiError("AUTH_SIGNUP_FAILED", 502, "x"))).toBe(
      AUTH_SIGNUP_MESSAGES.temporaryError,
    );
    expect(signupErrorMessage(new ApiError("AUTH_TERMS_SAVE_FAILED", 500, "x"))).toBe(
      AUTH_SIGNUP_MESSAGES.temporaryError,
    );
  });

  it("알 수 없는 코드는 기본 문구를 반환한다", () => {
    expect(signupErrorMessage(new ApiError("SOMETHING_ELSE", 400, "x"))).toBe(
      AUTH_SIGNUP_MESSAGES.genericError,
    );
  });

  it("ApiError가 아닌 오류도 기본 문구를 반환한다", () => {
    expect(signupErrorMessage(new Error("network"))).toBe(AUTH_SIGNUP_MESSAGES.genericError);
  });
});
