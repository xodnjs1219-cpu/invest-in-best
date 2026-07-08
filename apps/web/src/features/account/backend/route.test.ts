import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const withdrawAccountMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/account/backend/service", () => ({
  withdrawAccount: withdrawAccountMock,
}));

const { registerAccountRoutes } = await import("@/features/account/backend/route");

const buildApp = (user: { id: string } | null) => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", {} as never);
    c.set("supabaseAuth", {} as never);
    c.set("user", user);
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
  registerAccountRoutes(app);
  return app;
};

describe("DELETE /account", () => {
  beforeEach(() => {
    withdrawAccountMock.mockReset();
  });

  it("인증 없이 요청 시 401 UNAUTHORIZED를 반환하고 서비스는 호출되지 않는다", async () => {
    // Arrange
    const app = buildApp(null);

    // Act
    const res = await app.request("/account", { method: "DELETE" });

    // Assert
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(withdrawAccountMock).not.toHaveBeenCalled();
  });

  it("인증된 사용자가 요청 시 서비스 결과를 그대로 200으로 응답한다", async () => {
    // Arrange
    withdrawAccountMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { userId: "user-1", withdrawnAt: "2026-07-08T00:00:00.000Z" },
    });
    const app = buildApp({ id: "user-1" });

    // Act
    const res = await app.request("/account", { method: "DELETE" });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { userId: "user-1", withdrawnAt: "2026-07-08T00:00:00.000Z" },
    });
    expect(withdrawAccountMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), "user-1");
  });

  it("본문에 임의 userId를 담아도 무시하고 토큰의 본인 계정만 대상으로 한다(BR-7)", async () => {
    // Arrange
    withdrawAccountMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { userId: "user-1", withdrawnAt: "2026-07-08T00:00:00.000Z" },
    });
    const app = buildApp({ id: "user-1" });

    // Act
    await app.request("/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "someone-else" }),
    });

    // Assert
    expect(withdrawAccountMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), "user-1");
  });

  it("서비스가 409 실패를 반환하면 그대로 전달한다", async () => {
    // Arrange
    withdrawAccountMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: { code: "SOLE_ADMIN_WITHDRAWAL_BLOCKED", message: "유일 admin" },
    });
    const app = buildApp({ id: "admin-1" });

    // Act
    const res = await app.request("/account", { method: "DELETE" });

    // Assert
    expect(res.status).toBe(409);
  });

  it("서비스가 500 실패를 반환하면 그대로 전달하고 에러 로깅한다", async () => {
    // Arrange
    withdrawAccountMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: { code: "ACCOUNT_WITHDRAWAL_FAILED", message: "db down" },
    });
    const app = buildApp({ id: "user-1" });

    // Act
    const res = await app.request("/account", { method: "DELETE" });

    // Assert
    expect(res.status).toBe(500);
  });
});
