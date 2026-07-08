import { describe, expect, it, vi } from "vitest";
import {
  completeGoogleOAuth,
  confirmPasswordReset,
  loginWithEmail,
  logout,
  requestPasswordReset,
  signUp,
  startGoogleOAuth,
  verifyResetToken,
  type AuthRepositoryDeps,
} from "@/features/auth/backend/service";
import { authErrorCodes } from "@/features/auth/backend/error";
import type { LoginRequest, SignupRequest } from "@/features/auth/backend/schema";
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

describe("loginWithEmail 서비스 (UC-002)", () => {
  const loginRequest: LoginRequest = { email: "user@example.com", password: "abcd1234" };

  const createLoginDeps = (
    overrides?: Partial<{
      signInWithPassword: (
        authClient: unknown,
        email: string,
        password: string,
      ) => Promise<
        | { kind: "success"; userId: string; email: string }
        | { kind: "invalid_credentials" }
        | { kind: "email_not_confirmed" }
        | { kind: "rate_limited" }
        | { kind: "service_error"; message: string }
      >;
      findProfileById: (
        client: unknown,
        userId: string,
      ) => Promise<
        | { kind: "found"; row: { id: string; email: string | null; role: "user" | "admin" } }
        | { kind: "not_found" }
        | { kind: "error"; message: string }
      >;
      discardSession: (authClient: unknown) => Promise<void>;
    }>,
  ) => ({
    signInWithPassword: vi.fn(async () => ({
      kind: "success" as const,
      userId: "user-1",
      email: "user@example.com",
    })),
    findProfileById: vi.fn(async () => ({
      kind: "found" as const,
      row: { id: "user-1", email: "user@example.com", role: "user" as const },
    })),
    discardSession: vi.fn(async () => undefined),
    ...overrides,
  });

  it("인증 성공 + 프로필 조회 성공 → success에 camelCase DTO 반환", async () => {
    // Arrange
    const deps = createLoginDeps();

    // Act
    const result = await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { userId: "user-1", email: "user@example.com", role: "user" },
    });
  });

  it("role='admin' 프로필이면 응답 role이 admin이다", async () => {
    // Arrange
    const deps = createLoginDeps({
      findProfileById: vi.fn(async () => ({
        kind: "found" as const,
        row: { id: "user-1", email: "user@example.com", role: "admin" as const },
      })),
    });

    // Act
    const result = await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.role).toBe("admin");
    }
  });

  it("invalid_credentials → 401 AUTH_INVALID_CREDENTIALS", async () => {
    // Arrange
    const deps = createLoginDeps({
      signInWithPassword: vi.fn(async () => ({ kind: "invalid_credentials" as const })),
    });

    // Act
    const result = await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error.code).toBe(authErrorCodes.invalidCredentials);
    }
    expect(deps.findProfileById).not.toHaveBeenCalled();
    expect(deps.discardSession).not.toHaveBeenCalled();
  });

  it("email_not_confirmed → 403 AUTH_EMAIL_NOT_CONFIRMED", async () => {
    // Arrange
    const deps = createLoginDeps({
      signInWithPassword: vi.fn(async () => ({ kind: "email_not_confirmed" as const })),
    });

    // Act
    const result = await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error.code).toBe(authErrorCodes.emailNotConfirmed);
    }
  });

  it("rate_limited → 429 AUTH_RATE_LIMITED", async () => {
    // Arrange
    const deps = createLoginDeps({
      signInWithPassword: vi.fn(async () => ({ kind: "rate_limited" as const })),
    });

    // Act
    const result = await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.error.code).toBe(authErrorCodes.rateLimited);
    }
  });

  it("service_error → 502 AUTH_SERVICE_ERROR", async () => {
    // Arrange
    const deps = createLoginDeps({
      signInWithPassword: vi.fn(async () => ({ kind: "service_error" as const, message: "boom" })),
    });

    // Act
    const result = await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.error.code).toBe(authErrorCodes.serviceError);
    }
  });

  it("프로필 not_found → 500 AUTH_PROFILE_NOT_FOUND이고 discardSession이 1회 호출된다", async () => {
    // Arrange
    const deps = createLoginDeps({
      findProfileById: vi.fn(async () => ({ kind: "not_found" as const })),
    });

    // Act
    const result = await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(authErrorCodes.profileNotFound);
    }
    expect(deps.discardSession).toHaveBeenCalledTimes(1);
  });

  it("프로필 조회 error → 500 + discardSession 호출", async () => {
    // Arrange
    const deps = createLoginDeps({
      findProfileById: vi.fn(async () => ({ kind: "error" as const, message: "db down" })),
    });

    // Act
    const result = await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(authErrorCodes.profileNotFound);
    }
    expect(deps.discardSession).toHaveBeenCalledTimes(1);
  });

  it("Row 검증 실패(role='superuser') → 500 AUTH_VALIDATION_ERROR + discardSession 호출", async () => {
    // Arrange
    const deps = createLoginDeps({
      findProfileById: vi.fn(async () => ({
        kind: "found" as const,
        row: { id: "user-1", email: "user@example.com", role: "superuser" as never },
      })),
    });

    // Act
    const result = await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(authErrorCodes.validationError);
    }
    expect(deps.discardSession).toHaveBeenCalledTimes(1);
  });

  it("인증 실패 경로에서는 findProfileById·discardSession이 호출되지 않는다", async () => {
    // Arrange
    const deps = createLoginDeps({
      signInWithPassword: vi.fn(async () => ({ kind: "invalid_credentials" as const })),
    });

    // Act
    await loginWithEmail({} as never, {} as never, deps as never, loginRequest);

    // Assert
    expect(deps.findProfileById).not.toHaveBeenCalled();
    expect(deps.discardSession).not.toHaveBeenCalled();
  });
});

describe("startGoogleOAuth 서비스 (UC-003)", () => {
  const baseConfig = {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    supabaseServiceRoleKey: "service-role",
    adminSeedEmails: [] as readonly string[],
    origin: "https://app.example.com",
  };

  const createGatewayDeps = (overrides?: {
    createAuthorizationUrl?: (
      client: unknown,
      input: { provider: string; redirectTo: string },
    ) => Promise<
      | { kind: "success"; authorizationUrl: string }
      | { kind: "provider_unavailable"; message: string }
    >;
  }) => ({
    createAuthorizationUrl: vi.fn(async () => ({
      kind: "success" as const,
      authorizationUrl: "https://accounts.google.com/o/oauth2/auth",
    })),
    ...overrides,
  });

  it("정상: redirectPath 지정 시 authorizationUrl을 반환한다", async () => {
    // Arrange
    const deps = createGatewayDeps();

    // Act
    const result = await startGoogleOAuth(
      {} as never,
      deps as never,
      baseConfig,
      { provider: "google", redirectPath: "/valuechains/new" },
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.authorizationUrl).toBe("https://accounts.google.com/o/oauth2/auth");
    }
    expect(deps.createAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        provider: "google",
        redirectTo: expect.stringContaining("next=%2Fvaluechains%2Fnew"),
      }),
    );
  });

  it("redirectPath 미지정 시 next=%2F(기본값)로 진행한다", async () => {
    // Arrange
    const deps = createGatewayDeps();

    // Act
    await startGoogleOAuth({} as never, deps as never, baseConfig, { provider: "google" });

    // Assert
    expect(deps.createAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ redirectTo: expect.stringContaining("next=%2F") }),
    );
  });

  it("미지원 provider('naver') → 400 AUTH_UNSUPPORTED_PROVIDER", async () => {
    // Arrange
    const deps = createGatewayDeps();

    // Act
    const result = await startGoogleOAuth({} as never, deps as never, baseConfig, {
      provider: "naver",
    });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(authErrorCodes.unsupportedProvider);
    }
    expect(deps.createAuthorizationUrl).not.toHaveBeenCalled();
  });

  it("redirectPath가 외부 URL이면 400 AUTH_INVALID_REDIRECT_PATH", async () => {
    // Arrange
    const deps = createGatewayDeps();

    // Act
    const result = await startGoogleOAuth({} as never, deps as never, baseConfig, {
      provider: "google",
      redirectPath: "https://evil.com",
    });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(authErrorCodes.invalidRedirectPath);
    }
  });

  it("gateway provider_unavailable → 502 AUTH_OAUTH_START_FAILED", async () => {
    // Arrange
    const deps = createGatewayDeps({
      createAuthorizationUrl: vi.fn(async () => ({
        kind: "provider_unavailable" as const,
        message: "boom",
      })),
    });

    // Act
    const result = await startGoogleOAuth({} as never, deps as never, baseConfig, {
      provider: "google",
    });

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.error.code).toBe(authErrorCodes.oauthStartFailed);
    }
  });
});

describe("completeGoogleOAuth 서비스 (UC-003)", () => {
  const baseConfig = {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    supabaseServiceRoleKey: "service-role",
    adminSeedEmails: [] as readonly string[],
    origin: "https://app.example.com",
  };

  const now = () => new Date("2026-07-08T00:00:30.000Z");

  const createDeps = (overrides?: Record<string, unknown>) => ({
    exchangeCodeForSession: vi.fn(async () => ({
      kind: "success" as const,
      user: {
        id: "user-1",
        email: "a@b.com",
        emailVerified: true,
        createdAt: "2026-07-01T00:00:00.000Z", // 오래 전 = 기존 사용자
        lastSignInAt: "2026-07-08T00:00:00.000Z",
      },
    })),
    oauthSignOut: vi.fn(async () => undefined),
    findProfileById: vi.fn(async () => ({
      kind: "found" as const,
      row: { id: "user-1", email: "a@b.com", role: "user" as const },
    })),
    updateProfileRole: vi.fn(async () => ({ ok: true as const })),
    listTermsAgreementDocTypes: vi.fn(async () => ({
      kind: "found" as const,
      docTypes: ["terms_of_service", "privacy_policy"],
    })),
    insertTermsAgreements: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  });

  const request = { provider: "google", code: "auth-code", redirectPath: "/valuechains/new" };

  it("기존 사용자 정상 로그인: isNewUser=false, 약관 INSERT 미호출(멱등)", async () => {
    // Arrange
    const deps = createDeps();

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      request,
      now,
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isNewUser).toBe(false);
      expect(result.data.redirectPath).toBe("/valuechains/new");
      expect(result.data.user).toEqual({ id: "user-1", email: "a@b.com", role: "user" });
    }
    expect(deps.insertTermsAgreements).not.toHaveBeenCalled();
  });

  it("신규 가입: createdAt≈now → isNewUser=true, 필수 약관 2종 INSERT 호출", async () => {
    // Arrange
    const deps = createDeps({
      exchangeCodeForSession: vi.fn(async () => ({
        kind: "success" as const,
        user: {
          id: "user-2",
          email: "new@b.com",
          emailVerified: true,
          createdAt: "2026-07-08T00:00:15.000Z", // now() 기준 15초 전 = 신규
          lastSignInAt: "2026-07-08T00:00:15.000Z",
        },
      })),
      findProfileById: vi.fn(async () => ({
        kind: "found" as const,
        row: { id: "user-2", email: "new@b.com", role: "user" as const },
      })),
      listTermsAgreementDocTypes: vi.fn(async () => ({ kind: "found" as const, docTypes: [] })),
    });

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      request,
      now,
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isNewUser).toBe(true);
    }
    expect(deps.insertTermsAgreements).toHaveBeenCalledWith(
      expect.anything(),
      "user-2",
      expect.arrayContaining([
        expect.objectContaining({ docType: "terms_of_service" }),
        expect.objectContaining({ docType: "privacy_policy" }),
      ]),
    );
  });

  it("신규 가입 + ADMIN_SEED_EMAILS 일치 → promoteProfileToAdmin 호출, 응답 role admin", async () => {
    // Arrange
    const deps = createDeps({
      exchangeCodeForSession: vi.fn(async () => ({
        kind: "success" as const,
        user: {
          id: "user-3",
          email: "admin@example.com",
          emailVerified: true,
          createdAt: "2026-07-08T00:00:10.000Z",
          lastSignInAt: "2026-07-08T00:00:10.000Z",
        },
      })),
      findProfileById: vi.fn(async () => ({
        kind: "found" as const,
        row: { id: "user-3", email: "admin@example.com", role: "user" as const },
      })),
      listTermsAgreementDocTypes: vi.fn(async () => ({ kind: "found" as const, docTypes: [] })),
    });
    const config = { ...baseConfig, adminSeedEmails: ["admin@example.com"] };

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      config,
      request,
      now,
    );

    // Assert
    expect(deps.updateProfileRole).toHaveBeenCalledWith(expect.anything(), "user-3", "admin");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user.role).toBe("admin");
    }
  });

  it("이메일 미검증 → signOut 호출 + 403 AUTH_OAUTH_EMAIL_UNVERIFIED", async () => {
    // Arrange
    const deps = createDeps({
      exchangeCodeForSession: vi.fn(async () => ({
        kind: "success" as const,
        user: {
          id: "user-4",
          email: "unverified@b.com",
          emailVerified: false,
          createdAt: "2026-07-08T00:00:10.000Z",
          lastSignInAt: null,
        },
      })),
    });

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      request,
      now,
    );

    // Assert
    expect(deps.oauthSignOut).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error.code).toBe(authErrorCodes.oauthEmailUnverified);
    }
    expect(deps.findProfileById).not.toHaveBeenCalled();
  });

  it("이메일 미제공(null) → 동일 403", async () => {
    // Arrange
    const deps = createDeps({
      exchangeCodeForSession: vi.fn(async () => ({
        kind: "success" as const,
        user: {
          id: "user-5",
          email: null,
          emailVerified: false,
          createdAt: "2026-07-08T00:00:10.000Z",
          lastSignInAt: null,
        },
      })),
    });

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      request,
      now,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(authErrorCodes.oauthEmailUnverified);
    }
  });

  it("교환 exchange_rejected(코드 재사용) → 401 AUTH_OAUTH_EXCHANGE_FAILED", async () => {
    // Arrange
    const deps = createDeps({
      exchangeCodeForSession: vi.fn(async () => ({
        kind: "exchange_rejected" as const,
        message: "invalid grant",
      })),
    });

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      request,
      now,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error.code).toBe(authErrorCodes.oauthExchangeFailed);
    }
  });

  it("교환 provider_unavailable(타임아웃) → 502 AUTH_OAUTH_PROVIDER_ERROR", async () => {
    // Arrange
    const deps = createDeps({
      exchangeCodeForSession: vi.fn(async () => ({
        kind: "provider_unavailable" as const,
        message: "timeout",
      })),
    });

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      request,
      now,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.error.code).toBe(authErrorCodes.oauthProviderError);
    }
  });

  it("profile 조회 실패/null → 500 AUTH_PROFILE_LOAD_FAILED", async () => {
    // Arrange
    const deps = createDeps({
      findProfileById: vi.fn(async () => ({ kind: "not_found" as const })),
    });

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      request,
      now,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(authErrorCodes.profileLoadFailed);
    }
  });

  it("약관 INSERT 실패 → 성공 응답 유지 + 경고 메타 포함 (Edge 8)", async () => {
    // Arrange
    const deps = createDeps({
      exchangeCodeForSession: vi.fn(async () => ({
        kind: "success" as const,
        user: {
          id: "user-6",
          email: "new2@b.com",
          emailVerified: true,
          createdAt: "2026-07-08T00:00:10.000Z",
          lastSignInAt: "2026-07-08T00:00:10.000Z",
        },
      })),
      findProfileById: vi.fn(async () => ({
        kind: "found" as const,
        row: { id: "user-6", email: "new2@b.com", role: "user" as const },
      })),
      listTermsAgreementDocTypes: vi.fn(async () => ({ kind: "found" as const, docTypes: [] })),
      insertTermsAgreements: vi.fn(async () => ({ ok: false as const, message: "insert failed" })),
    });

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      request,
      now,
    );

    // Assert
    expect(result.ok).toBe(true);
    expect((result as { meta?: { termsSaveFailed?: boolean } }).meta?.termsSaveFailed).toBe(true);
  });

  it("redirectPath='//evil.com' → 오류 없이 redirectPath='/'로 성공 응답 (Edge 6)", async () => {
    // Arrange
    const deps = createDeps();

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      { ...request, redirectPath: "//evil.com" },
      now,
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectPath).toBe("/");
    }
  });

  it("약관 일부(1종)만 기존 존재 → 누락 1종만 INSERT (Edge 8 보정)", async () => {
    // Arrange
    const deps = createDeps({
      listTermsAgreementDocTypes: vi.fn(async () => ({
        kind: "found" as const,
        docTypes: ["terms_of_service"],
      })),
    });

    // Act
    await completeGoogleOAuth({} as never, {} as never, deps as never, baseConfig, request, now);

    // Assert
    expect(deps.insertTermsAgreements).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.arrayContaining([expect.objectContaining({ docType: "privacy_policy" })]),
    );
    const insertedDocTypes = (
      deps.insertTermsAgreements.mock.calls[0] as unknown as [unknown, unknown, { docType: string }[]]
    )[2].map((d) => d.docType);
    expect(insertedDocTypes).not.toContain("terms_of_service");
  });

  it("미지원 provider('naver') → 400 AUTH_UNSUPPORTED_PROVIDER, exchangeCodeForSession 미호출", async () => {
    // Arrange
    const deps = createDeps();

    // Act
    const result = await completeGoogleOAuth(
      {} as never,
      {} as never,
      deps as never,
      baseConfig,
      { ...request, provider: "naver" },
      now,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(authErrorCodes.unsupportedProvider);
    }
    expect(deps.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("requestPasswordReset 서비스 (UC-004)", () => {
  it("repo 성공 → 200 통일 응답", async () => {
    // Arrange
    const sendPasswordResetEmail = vi.fn(async () => ({ ok: true as const }));

    // Act
    const result = await requestPasswordReset(
      {} as never,
      { sendPasswordResetEmail } as never,
      "user@example.com",
      "https://app.example.com",
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ message: expect.any(String) });
    }
  });

  it("미가입 이메일도 가입 이메일과 완전히 동일한 응답 객체를 반환한다(열거 방지)", async () => {
    // Arrange
    const sendPasswordResetEmail = vi.fn(async () => ({ ok: true as const }));

    // Act
    const registered = await requestPasswordReset(
      {} as never,
      { sendPasswordResetEmail } as never,
      "registered@example.com",
      "https://app.example.com",
    );
    const unregistered = await requestPasswordReset(
      {} as never,
      { sendPasswordResetEmail } as never,
      "unregistered@example.com",
      "https://app.example.com",
    );

    // Assert
    expect(registered).toEqual(unregistered);
  });

  it("rate_limited → 429 PASSWORD_RESET_RATE_LIMITED", async () => {
    // Arrange
    const sendPasswordResetEmail = vi.fn(async () => ({
      ok: false as const,
      reason: "rate_limited" as const,
    }));

    // Act
    const result = await requestPasswordReset(
      {} as never,
      { sendPasswordResetEmail } as never,
      "user@example.com",
      "https://app.example.com",
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.error.code).toBe(authErrorCodes.passwordResetRateLimited);
    }
  });

  it("send_failed → 500 PASSWORD_RESET_SEND_FAILED, 메시지에 이메일 정보 미포함", async () => {
    // Arrange
    const sendPasswordResetEmail = vi.fn(async () => ({
      ok: false as const,
      reason: "send_failed" as const,
    }));

    // Act
    const result = await requestPasswordReset(
      {} as never,
      { sendPasswordResetEmail } as never,
      "user@example.com",
      "https://app.example.com",
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(authErrorCodes.passwordResetSendFailed);
      expect(result.error.message).not.toContain("user@example.com");
    }
  });
});

describe("verifyResetToken 서비스 (UC-004)", () => {
  it("ok → 200 {verified:true}", async () => {
    // Arrange
    const verifyRecoveryToken = vi.fn(async () => ({ ok: true as const }));

    // Act
    const result = await verifyResetToken({} as never, { verifyRecoveryToken } as never, "token-hash");

    // Assert
    expect(result).toEqual({ ok: true, status: 200, data: { verified: true } });
  });

  it("token_invalid → 400 PASSWORD_RESET_TOKEN_INVALID (만료/사용됨/위조 모두 동일)", async () => {
    // Arrange
    const verifyRecoveryToken = vi.fn(async () => ({
      ok: false as const,
      reason: "token_invalid" as const,
    }));

    // Act
    const result = await verifyResetToken({} as never, { verifyRecoveryToken } as never, "bad-token");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(authErrorCodes.passwordResetTokenInvalid);
    }
  });

  it("verify_failed → 500 PASSWORD_RESET_VERIFY_FAILED", async () => {
    // Arrange
    const verifyRecoveryToken = vi.fn(async () => ({
      ok: false as const,
      reason: "verify_failed" as const,
    }));

    // Act
    const result = await verifyResetToken({} as never, { verifyRecoveryToken } as never, "token");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(authErrorCodes.passwordResetVerifyFailed);
    }
  });
});

describe("confirmPasswordReset 서비스 (UC-004)", () => {
  const createConfirmDeps = (overrides?: Record<string, unknown>) => ({
    getRecoverySessionUser: vi.fn(async () => ({ id: "user-1" })),
    updatePasswordAndRevokeAllSessions: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  });

  it("정책 위반 비밀번호는 repo 호출 없이 400 PASSWORD_RESET_POLICY_VIOLATION", async () => {
    // Arrange
    const deps = createConfirmDeps();

    // Act
    const result = await confirmPasswordReset({} as never, deps as never, "short1");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(authErrorCodes.passwordResetPolicyViolation);
    }
    expect(deps.getRecoverySessionUser).not.toHaveBeenCalled();
  });

  it("재설정 세션 없음 → 401 PASSWORD_RESET_SESSION_INVALID", async () => {
    // Arrange
    const deps = createConfirmDeps({ getRecoverySessionUser: vi.fn(async () => null) });

    // Act
    const result = await confirmPasswordReset({} as never, deps as never, "abcd1234");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error.code).toBe(authErrorCodes.passwordResetSessionInvalid);
    }
    expect(deps.updatePasswordAndRevokeAllSessions).not.toHaveBeenCalled();
  });

  it("repo update_failed → 500 PASSWORD_RESET_UPDATE_FAILED", async () => {
    // Arrange
    const deps = createConfirmDeps({
      updatePasswordAndRevokeAllSessions: vi.fn(async () => ({
        ok: false as const,
        reason: "update_failed" as const,
      })),
    });

    // Act
    const result = await confirmPasswordReset({} as never, deps as never, "abcd1234");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(authErrorCodes.passwordResetUpdateFailed);
    }
  });

  it("repo session_invalid → 401 PASSWORD_RESET_SESSION_INVALID", async () => {
    // Arrange
    const deps = createConfirmDeps({
      updatePasswordAndRevokeAllSessions: vi.fn(async () => ({
        ok: false as const,
        reason: "session_invalid" as const,
      })),
    });

    // Act
    const result = await confirmPasswordReset({} as never, deps as never, "abcd1234");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error.code).toBe(authErrorCodes.passwordResetSessionInvalid);
    }
  });

  it("성공 → 200 완료 메시지, updatePasswordAndRevokeAllSessions가 정확히 1회 호출됨", async () => {
    // Arrange
    const deps = createConfirmDeps();

    // Act
    const result = await confirmPasswordReset({} as never, deps as never, "abcd1234");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ message: expect.any(String) });
    }
    expect(deps.updatePasswordAndRevokeAllSessions).toHaveBeenCalledTimes(1);
  });
});

describe("logout 서비스 (UC-005)", () => {
  it("repo가 revoked → ok:true, {loggedOut:true}, status 200", async () => {
    // Arrange
    const signOutCurrentSession = vi.fn(async () => ({ kind: "revoked" as const }));

    // Act
    const result = await logout({} as never, { signOutCurrentSession } as never);

    // Assert
    expect(result).toEqual({ ok: true, status: 200, data: { loggedOut: true } });
  });

  it("repo가 session_missing → 동일하게 ok:true, {loggedOut:true} (멱등)", async () => {
    // Arrange
    const signOutCurrentSession = vi.fn(async () => ({ kind: "session_missing" as const }));

    // Act
    const result = await logout({} as never, { signOutCurrentSession } as never);

    // Assert
    expect(result).toEqual({ ok: true, status: 200, data: { loggedOut: true } });
  });

  it("repo가 provider_error → ok:false, status 500, code AUTH_LOGOUT_FAILED, message 보존", async () => {
    // Arrange
    const signOutCurrentSession = vi.fn(async () => ({
      kind: "provider_error" as const,
      message: "gotrue down",
    }));

    // Act
    const result = await logout({} as never, { signOutCurrentSession } as never);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(authErrorCodes.logoutFailed);
      expect(result.error.message).toBe("gotrue down");
    }
  });

  it("동일 입력 2회 연속 호출 결과가 동일하다 (멱등성 회귀 테스트)", async () => {
    // Arrange
    const signOutCurrentSession = vi.fn(async () => ({ kind: "revoked" as const }));

    // Act
    const first = await logout({} as never, { signOutCurrentSession } as never);
    const second = await logout({} as never, { signOutCurrentSession } as never);

    // Assert
    expect(first).toEqual(second);
  });
});
