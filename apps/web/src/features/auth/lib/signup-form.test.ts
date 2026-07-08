import { describe, expect, it } from "vitest";
import { LEGAL_DOCS } from "@iib/domain";
import { signupFormSchema, toSignupRequest } from "@/features/auth/lib/signup-form";

const validForm = {
  email: "user@example.com",
  password: "abcd1234",
  passwordConfirm: "abcd1234",
  agreeTerms: true as const,
  agreePrivacy: true as const,
};

describe("signupFormSchema", () => {
  it("유효 입력을 통과시킨다", () => {
    expect(signupFormSchema.safeParse(validForm).success).toBe(true);
  });

  it("약관 중 하나라도 false면 실패한다 (E4)", () => {
    expect(signupFormSchema.safeParse({ ...validForm, agreeTerms: false }).success).toBe(false);
    expect(signupFormSchema.safeParse({ ...validForm, agreePrivacy: false }).success).toBe(false);
  });

  it("비밀번호 확인 불일치 시 실패한다 (E3)", () => {
    expect(
      signupFormSchema.safeParse({ ...validForm, passwordConfirm: "different1" }).success,
    ).toBe(false);
  });

  it("정책 미달 비밀번호는 실패한다", () => {
    expect(
      signupFormSchema.safeParse({ ...validForm, password: "abcdefgh", passwordConfirm: "abcdefgh" })
        .success,
    ).toBe(false);
  });
});

describe("toSignupRequest", () => {
  it("체크박스 2종을 2종 docType과 현행 docVersion을 포함한 배열로 변환한다", () => {
    // Act
    const request = toSignupRequest(validForm);

    // Assert
    expect(request.termsAgreements).toEqual([
      { docType: "terms_of_service", docVersion: LEGAL_DOCS.terms_of_service.version },
      { docType: "privacy_policy", docVersion: LEGAL_DOCS.privacy_policy.version },
    ]);
    expect(request.email).toBe(validForm.email);
    expect(request.password).toBe(validForm.password);
    expect(request.passwordConfirm).toBe(validForm.passwordConfirm);
  });

  it("redirectTo 미존재 시 필드가 생략된다", () => {
    const request = toSignupRequest(validForm);
    expect(request.redirectTo).toBeUndefined();
  });

  it("redirectTo가 주어지면 포함한다", () => {
    const request = toSignupRequest(validForm, "/chains/new");
    expect(request.redirectTo).toBe("/chains/new");
  });
});
