import { describe, expect, it } from "vitest";
import { loginFormSchema, toLoginRequest } from "@/features/auth/lib/login-form";

describe("loginFormSchema", () => {
  it("유효 이메일/비밀번호는 통과한다", () => {
    // Act
    const result = loginFormSchema.safeParse({ email: "user@example.com", password: "abcd1234" });

    // Assert
    expect(result.success).toBe(true);
  });

  it("이메일 형식 오류는 실패한다", () => {
    // Act
    const result = loginFormSchema.safeParse({ email: "not-an-email", password: "abcd1234" });

    // Assert
    expect(result.success).toBe(false);
  });

  it("빈 비밀번호는 실패한다", () => {
    // Act
    const result = loginFormSchema.safeParse({ email: "user@example.com", password: "" });

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("toLoginRequest", () => {
  it("폼 값을 그대로 LoginRequest로 매핑한다", () => {
    // Act
    const result = toLoginRequest({ email: "user@example.com", password: "abcd1234" });

    // Assert
    expect(result).toEqual({ email: "user@example.com", password: "abcd1234" });
  });
});
