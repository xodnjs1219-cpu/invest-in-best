import { describe, expect, it } from "vitest";
import { SignupRequestSchema, SignupResponseSchema, TermsAgreementRowSchema } from "./schema";

describe("SignupRequestSchema", () => {
  const validBody = {
    email: "Test@Example.com",
    password: "abcdefgh",
    passwordConfirm: "abcdefgh",
    termsAgreements: [
      { docType: "terms_of_service", docVersion: "v1.0" },
      { docType: "privacy_policy", docVersion: "v1.0" },
    ],
  };

  it("유효 요청 body가 파싱되고 email이 소문자로 정규화된다", () => {
    const parsed = SignupRequestSchema.parse(validBody);
    expect(parsed.email).toBe("test@example.com");
  });

  it("이메일 형식 오류 시 실패한다 (E5)", () => {
    const result = SignupRequestSchema.safeParse({ ...validBody, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("필드 누락 시 실패한다 (E5)", () => {
    const rest: Partial<typeof validBody> = { ...validBody };
    delete rest.password;
    const result = SignupRequestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("정책 미달 비밀번호('abcdefgh')도 스키마는 통과한다 (정책 판정은 서비스 소관)", () => {
    // abcdefgh: 숫자 없음 — passwordSchema라면 실패하지만 요청 스키마는 형식 최소 검증만 한다.
    const result = SignupRequestSchema.safeParse({ ...validBody, password: "abcdefgh" });
    expect(result.success).toBe(true);
  });

  it("정책 미달 비밀번호('a1')도 스키마는 통과한다 (정책 판정은 서비스 소관)", () => {
    const result = SignupRequestSchema.safeParse({
      ...validBody,
      password: "a1",
      passwordConfirm: "a1",
    });
    expect(result.success).toBe(true);
  });

  it("docType에 enum 외 값이 오면 실패한다", () => {
    const result = SignupRequestSchema.safeParse({
      ...validBody,
      termsAgreements: [{ docType: "unknown_doc", docVersion: "v1.0" }],
    });
    expect(result.success).toBe(false);
  });

  it("redirectTo는 선택 필드다", () => {
    const parsed = SignupRequestSchema.parse({ ...validBody, redirectTo: "/chains/new" });
    expect(parsed.redirectTo).toBe("/chains/new");
  });
});

describe("SignupResponseSchema", () => {
  it("email과 verificationEmailSent:true를 검증한다", () => {
    const result = SignupResponseSchema.safeParse({
      email: "a@b.com",
      verificationEmailSent: true,
    });
    expect(result.success).toBe(true);
  });

  it("verificationEmailSent가 false면 실패한다 (항상 true 리터럴)", () => {
    const result = SignupResponseSchema.safeParse({
      email: "a@b.com",
      verificationEmailSent: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("TermsAgreementRowSchema", () => {
  it("0002 마이그레이션 컬럼(snake_case)과 일치하는 행을 파싱한다", () => {
    const row = {
      id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      doc_type: "terms_of_service",
      doc_version: "v1.0",
      agreed_at: "2026-07-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    };
    expect(TermsAgreementRowSchema.safeParse(row).success).toBe(true);
  });
});
