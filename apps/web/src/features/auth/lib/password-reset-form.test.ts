import { describe, expect, it } from "vitest";
import {
  newPasswordFormSchema,
  passwordResetRequestFormSchema,
} from "@/features/auth/lib/password-reset-form";

describe("passwordResetRequestFormSchema", () => {
  it("유효 이메일은 통과한다", () => {
    expect(passwordResetRequestFormSchema.safeParse({ email: "user@example.com" }).success).toBe(
      true,
    );
  });

  it("이메일 형식 오류는 실패한다", () => {
    expect(passwordResetRequestFormSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });
});

describe("newPasswordFormSchema", () => {
  it("정책 충족 + 확인 일치는 통과한다", () => {
    const result = newPasswordFormSchema.safeParse({
      newPassword: "abcd1234",
      newPasswordConfirm: "abcd1234",
    });
    expect(result.success).toBe(true);
  });

  it("7자 이하는 실패한다", () => {
    const result = newPasswordFormSchema.safeParse({
      newPassword: "abc123",
      newPasswordConfirm: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("확인 값 불일치는 실패한다", () => {
    const result = newPasswordFormSchema.safeParse({
      newPassword: "abcd1234",
      newPasswordConfirm: "different1",
    });
    expect(result.success).toBe(false);
  });
});
