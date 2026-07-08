import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const signUpMock = vi.hoisted(() => vi.fn());
const loginWithEmailMock = vi.hoisted(() => vi.fn());
const startGoogleOAuthMock = vi.hoisted(() => vi.fn());
const completeGoogleOAuthMock = vi.hoisted(() => vi.fn());
const requestPasswordResetMock = vi.hoisted(() => vi.fn());
const verifyResetTokenMock = vi.hoisted(() => vi.fn());
const confirmPasswordResetMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/backend/service", () => ({
  signUp: signUpMock,
  loginWithEmail: loginWithEmailMock,
  startGoogleOAuth: startGoogleOAuthMock,
  completeGoogleOAuth: completeGoogleOAuthMock,
  requestPasswordReset: requestPasswordResetMock,
  verifyResetToken: verifyResetTokenMock,
  confirmPasswordReset: confirmPasswordResetMock,
  logout: logoutMock,
}));

const { registerAuthRoutes } = await import("@/features/auth/backend/route");

const buildApp = () => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", {} as never);
    c.set("supabaseAuth", {} as never);
    c.set("logger", { debug() {}, info() {}, warn() {}, error() {} });
    c.set("config", {
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
      supabaseServiceRoleKey: "service-role",
      adminSeedEmails: [],
      origin: "https://app.example.com",
    });
    await next();
  });
  registerAuthRoutes(app);
  return app;
};

const validBody = {
  email: "user@example.com",
  password: "abcd1234",
  passwordConfirm: "abcd1234",
  termsAgreements: [
    { docType: "terms_of_service", docVersion: "v1.0" },
    { docType: "privacy_policy", docVersion: "v1.0" },
  ],
};

describe("POST /auth/signup", () => {
  beforeEach(() => {
    signUpMock.mockReset();
  });

  it("유효 body로 요청 시 signUp 서비스 결과를 그대로 200으로 응답한다", async () => {
    // Arrange
    signUpMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { email: "user@example.com", verificationEmailSent: true },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { email: "user@example.com", verificationEmailSent: true },
    });
  });

  it("요청 스키마 위반 시 400 INVALID_REQUEST를 반환하고 서비스는 호출하지 않는다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validBody, email: "not-an-email" }),
    });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("서비스가 400 실패를 반환하면 그대로 전달한다", async () => {
    // Arrange
    signUpMock.mockResolvedValue({
      ok: false,
      status: 400,
      error: { code: "AUTH_TERMS_NOT_AGREED", message: "약관 동의가 필요합니다." },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "AUTH_TERMS_NOT_AGREED", message: "약관 동의가 필요합니다." },
    });
  });

  it("서비스가 502 실패를 반환하면 응답 body에 Supabase 원문 오류를 노출하지 않는다", async () => {
    // Arrange
    signUpMock.mockResolvedValue({
      ok: false,
      status: 502,
      error: { code: "AUTH_SIGNUP_FAILED", message: "가입 처리 중 오류가 발생했습니다." },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });

    // Assert
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("AUTH_SIGNUP_FAILED");
  });
});

describe("POST /auth/login", () => {
  beforeEach(() => {
    loginWithEmailMock.mockReset();
  });

  const validLoginBody = { email: "user@example.com", password: "abcd1234" };

  it("유효 body로 요청 시 loginWithEmail 서비스 결과를 그대로 200으로 응답한다", async () => {
    // Arrange
    loginWithEmailMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { userId: "user-1", email: "user@example.com", role: "user" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validLoginBody),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { userId: "user-1", email: "user@example.com", role: "user" },
    });
  });

  it("요청 스키마 위반 시 400 INVALID_REQUEST를 반환하고 서비스는 호출하지 않는다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "" }),
    });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(loginWithEmailMock).not.toHaveBeenCalled();
  });

  it("서비스가 401 실패를 반환하면 그대로 전달한다", async () => {
    // Arrange
    loginWithEmailMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: { code: "AUTH_INVALID_CREDENTIALS", message: "이메일 또는 비밀번호가 올바르지 않습니다." },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validLoginBody),
    });

    // Assert
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "AUTH_INVALID_CREDENTIALS", message: "이메일 또는 비밀번호가 올바르지 않습니다." },
    });
  });

  it("JSON이 아닌 바디는 400 INVALID_REQUEST를 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(loginWithEmailMock).not.toHaveBeenCalled();
  });
});

describe("POST /auth/oauth/:provider/start", () => {
  beforeEach(() => {
    startGoogleOAuthMock.mockReset();
  });

  it("유효 body로 요청 시 startGoogleOAuth 결과를 그대로 200으로 응답한다", async () => {
    // Arrange
    startGoogleOAuthMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { authorizationUrl: "https://accounts.google.com/o/oauth2/auth" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/oauth/google/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirectPath: "/valuechains/new" }),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { authorizationUrl: "https://accounts.google.com/o/oauth2/auth" },
    });
    expect(startGoogleOAuthMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ provider: "google", redirectPath: "/valuechains/new" }),
    );
  });

  it("body 없이 요청해도 400이 아니다(redirectPath 선택)", async () => {
    // Arrange
    startGoogleOAuthMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { authorizationUrl: "https://accounts.google.com/o/oauth2/auth" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/oauth/google/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    // Assert
    expect(res.status).toBe(200);
  });

  it("서비스가 400 실패를 반환하면 그대로 전달한다", async () => {
    // Arrange
    startGoogleOAuthMock.mockResolvedValue({
      ok: false,
      status: 400,
      error: { code: "AUTH_UNSUPPORTED_PROVIDER", message: "지원하지 않는 로그인 제공자입니다." },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/oauth/naver/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "AUTH_UNSUPPORTED_PROVIDER", message: "지원하지 않는 로그인 제공자입니다." },
    });
  });
});

describe("POST /auth/oauth/:provider/callback", () => {
  beforeEach(() => {
    completeGoogleOAuthMock.mockReset();
  });

  it("유효 body로 요청 시 completeGoogleOAuth 결과를 그대로 200으로 응답한다", async () => {
    // Arrange
    completeGoogleOAuthMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        user: { id: "user-1", email: "a@b.com", role: "user" },
        isNewUser: false,
        redirectPath: "/",
      },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/oauth/google/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "auth-code" }),
    });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { isNewUser: boolean } };
    expect(body.data.isNewUser).toBe(false);
  });

  it("code 누락 시 400 INVALID_REQUEST를 반환하고 서비스는 호출하지 않는다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/auth/oauth/google/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(completeGoogleOAuthMock).not.toHaveBeenCalled();
  });

  it("서비스가 401 실패를 반환하면 그대로 전달한다", async () => {
    // Arrange
    completeGoogleOAuthMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: { code: "AUTH_OAUTH_EXCHANGE_FAILED", message: "교환 실패" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/oauth/google/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "used-code" }),
    });

    // Assert
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/password-reset/request", () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it("유효 이메일 요청 시 200 통일 응답을 반환한다", async () => {
    // Arrange
    requestPasswordResetMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "재설정 안내 메일 발송 처리됨" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(requestPasswordResetMock).toHaveBeenCalled();
  });

  it("이메일 형식 오류 시 400 PASSWORD_RESET_INVALID_EMAIL을 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/auth/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "abc" }),
    });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PASSWORD_RESET_INVALID_EMAIL");
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });
});

describe("POST /auth/password-reset/verify", () => {
  beforeEach(() => {
    verifyResetTokenMock.mockReset();
  });

  it("유효 tokenHash 시 200 {verified:true}를 반환한다", async () => {
    // Arrange
    verifyResetTokenMock.mockResolvedValue({ ok: true, status: 200, data: { verified: true } });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/password-reset/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokenHash: "token-hash-abc" }),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { verified: true } });
  });

  it("tokenHash 누락 시 400 PASSWORD_RESET_TOKEN_INVALID을 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/auth/password-reset/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PASSWORD_RESET_TOKEN_INVALID");
    expect(verifyResetTokenMock).not.toHaveBeenCalled();
  });
});

describe("POST /auth/password-reset/confirm", () => {
  beforeEach(() => {
    confirmPasswordResetMock.mockReset();
  });

  it("정책 충족 비밀번호 제출 시 200 완료 메시지를 반환한다", async () => {
    // Arrange
    confirmPasswordResetMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "비밀번호 재설정 완료" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword: "abcd1234" }),
    });

    // Assert
    expect(res.status).toBe(200);
  });

  it("newPassword 누락 시 400 PASSWORD_RESET_POLICY_VIOLATION을 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/auth/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PASSWORD_RESET_POLICY_VIOLATION");
    expect(confirmPasswordResetMock).not.toHaveBeenCalled();
  });

  it("서비스가 401 실패를 반환하면 그대로 전달한다", async () => {
    // Arrange
    confirmPasswordResetMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: { code: "PASSWORD_RESET_SESSION_INVALID", message: "세션 만료" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword: "abcd1234" }),
    });

    // Assert
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  beforeEach(() => {
    logoutMock.mockReset();
  });

  it("성공 시 200 {loggedOut:true}를 반환한다", async () => {
    // Arrange
    logoutMock.mockResolvedValue({ ok: true, status: 200, data: { loggedOut: true } });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/logout", { method: "POST" });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { loggedOut: true } });
  });

  it("본문 없이 호출해도 정상 처리된다(요청 계약)", async () => {
    // Arrange
    logoutMock.mockResolvedValue({ ok: true, status: 200, data: { loggedOut: true } });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/logout", { method: "POST" });

    // Assert
    expect(res.status).toBe(200);
  });

  it("임의 JSON 본문을 포함해도 무시하고 정상 처리한다", async () => {
    // Arrange
    logoutMock.mockResolvedValue({ ok: true, status: 200, data: { loggedOut: true } });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ arbitrary: "data" }),
    });

    // Assert
    expect(res.status).toBe(200);
  });

  it("서비스가 500 실패를 반환하면 그대로 전달한다", async () => {
    // Arrange
    logoutMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: { code: "AUTH_LOGOUT_FAILED", message: "gotrue down" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/auth/logout", { method: "POST" });

    // Assert
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: "AUTH_LOGOUT_FAILED", message: "gotrue down" } });
  });

  it("GET /auth/logout은 404다 (POST만 등록)", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/auth/logout", { method: "GET" });

    // Assert
    expect(res.status).toBe(404);
  });
});
