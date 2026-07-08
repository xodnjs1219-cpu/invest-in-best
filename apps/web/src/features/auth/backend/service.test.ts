import { describe, expect, it, vi } from "vitest";
import { signUp, type AuthRepositoryDeps } from "@/features/auth/backend/service";
import { authErrorCodes } from "@/features/auth/backend/error";
import type { SignupRequest } from "@/features/auth/backend/schema";
import { LEGAL_DOCS } from "@iib/domain";

const currentDocVersion = LEGAL_DOCS.terms_of_service.version;

const baseRequest: SignupRequest = {
  email: "user@example.com",
  password: "abcd1234",
  passwordConfirm: "abcd1234",
  termsAgreements: [
    { docType: "terms_of_service", docVersion: currentDocVersion },
    { docType: "privacy_policy", docVersion: currentDocVersion },
  ],
};

const baseConfig = {
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon",
  supabaseServiceRoleKey: "service-role",
  adminSeedEmails: [] as readonly string[],
  origin: "https://app.example.com",
};

const createDeps = (overrides?: Partial<AuthRepositoryDeps>): AuthRepositoryDeps => ({
  signUpWithEmail: vi.fn(async () => ({ kind: "created" as const, userId: "user-1" })),
  insertTermsAgreements: vi.fn(async () => ({ ok: true as const })),
  updateProfileRole: vi.fn(async () => ({ ok: true as const })),
  ...overrides,
});

describe("signUp 서비스", () => {
  it("정상 신규 가입: signUp→terms 저장 순서로 호출되고 200 통일 응답을 반환한다", async () => {
    // Arrange
    const calls: string[] = [];
    const deps = createDeps({
      signUpWithEmail: vi.fn(async () => {
        calls.push("signUp");
        return { kind: "created" as const, userId: "user-1" };
      }),
      insertTermsAgreements: vi.fn(async () => {
        calls.push("terms");
        return { ok: true as const };
      }),
    });

    // Act
    const result = await signUp({} as never, deps, baseConfig, baseRequest);

    // Assert
    expect(calls).toEqual(["signUp", "terms"]);
    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { email: "user@example.com", verificationEmailSent: true },
    });
  });

  it("비밀번호 정책 위반 시 400 AUTH_PASSWORD_POLICY_VIOLATION, repository 미호출", async () => {
    // Arrange: 숫자 없는 비밀번호
    const deps = createDeps();
    const request = { ...baseRequest, password: "abcdefgh", passwordConfirm: "abcdefgh" };

    // Act
    const result = await signUp({} as never, deps, baseConfig, request);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(authErrorCodes.passwordPolicyViolation);
    }
    expect(deps.signUpWithEmail).not.toHaveBeenCalled();
  });

  it("비밀번호 확인 불일치 시 400 AUTH_PASSWORD_CONFIRM_MISMATCH, repository 미호출", async () => {
    // Arrange
    const deps = createDeps();
    const request = { ...baseRequest, passwordConfirm: "different1" };

    // Act
    const result = await signUp({} as never, deps, baseConfig, request);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(authErrorCodes.passwordConfirmMismatch);
    }
    expect(deps.signUpWithEmail).not.toHaveBeenCalled();
  });

  it("약관 1종만 포함 시 400 AUTH_TERMS_NOT_AGREED, repository 미호출", async () => {
    // Arrange
    const deps = createDeps();
    const request = {
      ...baseRequest,
      termsAgreements: [{ docType: "terms_of_service" as const, docVersion: currentDocVersion }],
    };

    // Act
    const result = await signUp({} as never, deps, baseConfig, request);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(authErrorCodes.termsNotAgreed);
    }
    expect(deps.signUpWithEmail).not.toHaveBeenCalled();
  });

  it("동일 docType 2개(중복) + 누락 1종은 400 AUTH_TERMS_NOT_AGREED (집합 기준 판정)", async () => {
    // Arrange
    const deps = createDeps();
    const request = {
      ...baseRequest,
      termsAgreements: [
        { docType: "terms_of_service" as const, docVersion: currentDocVersion },
        { docType: "terms_of_service" as const, docVersion: currentDocVersion },
      ],
    };

    // Act
    const result = await signUp({} as never, deps, baseConfig, request);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(authErrorCodes.termsNotAgreed);
    }
  });

  it("existing 결과는 terms/승격 호출 없이 200 통일 응답을 반환한다 (성공 케이스와 body 완전 동일)", async () => {
    // Arrange
    const deps = createDeps({
      signUpWithEmail: vi.fn(async () => ({ kind: "existing" as const })),
    });

    // Act
    const result = await signUp({} as never, deps, baseConfig, baseRequest);

    // Assert
    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { email: "user@example.com", verificationEmailSent: true },
    });
    expect(deps.insertTermsAgreements).not.toHaveBeenCalled();
    expect(deps.updateProfileRole).not.toHaveBeenCalled();
  });

  it("rate_limited 결과는 429 AUTH_RATE_LIMITED를 반환한다", async () => {
    // Arrange
    const deps = createDeps({
      signUpWithEmail: vi.fn(async () => ({ kind: "rate_limited" as const })),
    });

    // Act
    const result = await signUp({} as never, deps, baseConfig, baseRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.error.code).toBe(authErrorCodes.rateLimited);
    }
  });

  it("error 결과는 502 AUTH_SIGNUP_FAILED를 반환한다", async () => {
    // Arrange
    const deps = createDeps({
      signUpWithEmail: vi.fn(async () => ({ kind: "error" as const, message: "boom" })),
    });

    // Act
    const result = await signUp({} as never, deps, baseConfig, baseRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.error.code).toBe(authErrorCodes.signupFailed);
    }
  });

  it("terms 저장 실패 시 500 AUTH_TERMS_SAVE_FAILED를 반환한다", async () => {
    // Arrange
    const deps = createDeps({
      insertTermsAgreements: vi.fn(async () => ({ ok: false as const, message: "insert failed" })),
    });

    // Act
    const result = await signUp({} as never, deps, baseConfig, baseRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(authErrorCodes.termsSaveFailed);
    }
  });

  it("ADMIN_SEED_EMAILS에 포함된 이메일(대소문자 상이)은 updateProfileRole('admin')을 호출한다", async () => {
    // Arrange
    const deps = createDeps();
    const config = { ...baseConfig, adminSeedEmails: ["user@example.com"] };
    const request = { ...baseRequest, email: "User@Example.com" };

    // Act
    await signUp({} as never, deps, config, request);

    // Assert
    expect(deps.updateProfileRole).toHaveBeenCalledWith(expect.anything(), "user-1", "admin");
  });

  it("미포함 이메일은 승격을 호출하지 않는다", async () => {
    // Arrange
    const deps = createDeps();
    const config = { ...baseConfig, adminSeedEmails: ["other@example.com"] };

    // Act
    await signUp({} as never, deps, config, baseRequest);

    // Assert
    expect(deps.updateProfileRole).not.toHaveBeenCalled();
  });

  it("승격 실패 시에도 200 통일 응답 + meta 플래그가 설정된다", async () => {
    // Arrange
    const deps = createDeps({
      updateProfileRole: vi.fn(async () => ({ ok: false as const, message: "promote failed" })),
    });
    const config = { ...baseConfig, adminSeedEmails: ["user@example.com"] };

    // Act
    const result = await signUp({} as never, deps, config, baseRequest);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ email: "user@example.com", verificationEmailSent: true });
    }
    expect(
      (result as { meta?: { adminPromotionFailed?: boolean } }).meta?.adminPromotionFailed,
    ).toBe(true);
  });

  it("저장되는 docVersion은 요청 값이 아닌 LEGAL_DOCS 현행 버전이다", async () => {
    // Arrange
    const deps = createDeps();
    const request = {
      ...baseRequest,
      termsAgreements: [
        { docType: "terms_of_service" as const, docVersion: "stale-version" },
        { docType: "privacy_policy" as const, docVersion: "stale-version" },
      ],
    };

    // Act
    await signUp({} as never, deps, baseConfig, request);

    // Assert
    expect(deps.insertTermsAgreements).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.arrayContaining([
        expect.objectContaining({
          docType: "terms_of_service",
          docVersion: LEGAL_DOCS.terms_of_service.version,
        }),
        expect.objectContaining({
          docType: "privacy_policy",
          docVersion: LEGAL_DOCS.privacy_policy.version,
        }),
      ]),
    );
  });

  it("외부 redirectTo='https://evil.com'는 emailRedirectTo의 redirectTo가 '/'로 대체된다", async () => {
    // Arrange
    const deps = createDeps();
    const request = { ...baseRequest, redirectTo: "https://evil.com" };

    // Act
    await signUp({} as never, deps, baseConfig, request);

    // Assert
    expect(deps.signUpWithEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        emailRedirectTo: `${baseConfig.origin}/auth/callback?redirectTo=%2F`,
      }),
    );
  });
});
