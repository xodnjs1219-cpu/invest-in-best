import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";
import { relationTypeErrorCodes } from "@/features/relation-types/backend/error";

const getRelationTypesMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/relation-types/backend/service", () => ({
  getRelationTypes: getRelationTypesMock,
}));

const { registerRelationTypeRoutes } = await import("@/features/relation-types/backend/route");

const buildApp = (user: { id: string } | null = { id: "user-1" }) => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", {} as never);
    c.set("logger", { debug() {}, info() {}, warn() {}, error() {} });
    c.set("user", user);
    await next();
  });
  registerRelationTypeRoutes(app);
  return app;
};

describe("GET /relation-types", () => {
  beforeEach(() => {
    getRelationTypesMock.mockReset();
  });

  it("로그인 상태 → service 결과를 그대로 200으로 응답", async () => {
    // Arrange
    getRelationTypesMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { relationTypes: [{ id: "rt1", name: "공급", isDirected: true, isActive: true }] },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/relation-types");

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { relationTypes: [{ id: "rt1", name: "공급", isDirected: true, isActive: true }] },
    });
    expect(getRelationTypesMock).toHaveBeenCalledWith(expect.anything(), { activeOnly: false });
  });

  it("active=true 쿼리 → activeOnly:true로 서비스 호출", async () => {
    // Arrange
    getRelationTypesMock.mockResolvedValue({ ok: true, status: 200, data: { relationTypes: [] } });
    const app = buildApp();

    // Act
    await app.request("/relation-types?active=true");

    // Assert
    expect(getRelationTypesMock).toHaveBeenCalledWith(expect.anything(), { activeOnly: true });
  });

  it("active=banana(잘못된 값) → 400 INVALID_QUERY, service 미호출", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/relation-types?active=banana");

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(relationTypeErrorCodes.invalidQuery);
    expect(getRelationTypesMock).not.toHaveBeenCalled();
  });

  it("미로그인 → 401 UNAUTHORIZED, service 미호출", async () => {
    // Arrange
    const app = buildApp(null);

    // Act
    const res = await app.request("/relation-types");

    // Assert
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(relationTypeErrorCodes.unauthorized);
    expect(getRelationTypesMock).not.toHaveBeenCalled();
  });

  it("service 500 오류 → 그대로 500 응답", async () => {
    // Arrange
    getRelationTypesMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: { code: relationTypeErrorCodes.fetchFailed, message: "DB 오류" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/relation-types");

    // Assert
    expect(res.status).toBe(500);
  });
});
