import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const signUpMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/backend/service", () => ({
  signUp: signUpMock,
}));

const { registerAuthRoutes } = await import("@/features/auth/backend/route");

const buildApp = () => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", {} as never);
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
