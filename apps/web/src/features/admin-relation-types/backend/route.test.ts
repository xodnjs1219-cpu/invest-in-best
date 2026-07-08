import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const listRelationTypesMock = vi.hoisted(() => vi.fn());
const createRelationTypeMock = vi.hoisted(() => vi.fn());
const updateRelationTypeMock = vi.hoisted(() => vi.fn());
const withAdminAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/admin-relation-types/backend/service", () => ({
  listRelationTypes: listRelationTypesMock,
  createRelationType: createRelationTypeMock,
  updateRelationType: updateRelationTypeMock,
}));

const ADMIN_USER = { id: "admin-1", email: "admin@example.com" };

vi.mock("@/backend/middleware/admin", () => ({
  withAdminAuth: () => withAdminAuthMock,
  adminAuthErrorCodes: { unauthorized: "UNAUTHORIZED", adminOnly: "ADMIN_ONLY" },
}));

const { registerAdminRelationTypeRoutes } = await import(
  "@/features/admin-relation-types/backend/route"
);

const RELATION_TYPE_ID = "11111111-1111-4111-8111-111111111111";

const buildApp = (options?: { adminUser?: typeof ADMIN_USER | null }) => {
  const adminUser = options?.adminUser === undefined ? ADMIN_USER : options.adminUser;
  withAdminAuthMock.mockImplementation(async (c, next) => {
    if (!adminUser) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }, 401);
    }
    c.set("adminUser", adminUser);
    await next();
  });

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", {} as never);
    c.set("supabaseAuth", {} as never);
    c.set("logger", { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
    c.set("config", {
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
      supabaseServiceRoleKey: "service-role",
      adminSeedEmails: [],
      origin: "https://app.example.com",
    });
    await next();
  });
  registerAdminRelationTypeRoutes(app);
  return app;
};

describe("GET /admin/relation-types", () => {
  beforeEach(() => {
    listRelationTypesMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("Admin 요청 시 서비스 결과를 200으로 응답한다", async () => {
    // Arrange
    listRelationTypesMock.mockResolvedValue({ ok: true, status: 200, data: { relationTypes: [] } });
    const app = buildApp();

    // Act
    const res = await app.request("/admin/relation-types");

    // Assert
    expect(res.status).toBe(200);
    expect(listRelationTypesMock).toHaveBeenCalledWith(expect.anything());
  });

  it("비인증 요청은 401을 반환하고 서비스는 호출되지 않는다(E5)", async () => {
    // Arrange
    const app = buildApp({ adminUser: null });

    // Act
    const res = await app.request("/admin/relation-types");
    const body = (await res.json()) as { error: { code: string } };

    // Assert
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(listRelationTypesMock).not.toHaveBeenCalled();
  });
});

describe("POST /admin/relation-types", () => {
  beforeEach(() => {
    createRelationTypeMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("유효 body로 요청 시 서비스를 호출하고 결과를 그대로 응답한다", async () => {
    // Arrange
    createRelationTypeMock.mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: RELATION_TYPE_ID, name: "라이선스", isDirected: true, isActive: true },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/admin/relation-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "라이선스" }),
    });

    // Assert
    expect(res.status).toBe(201);
    expect(createRelationTypeMock).toHaveBeenCalledWith(
      expect.anything(),
      { name: "라이선스", isDirected: true },
    );
  });

  it("name 누락 시 400 VALIDATION_ERROR를 반환하고 서비스는 호출하지 않는다(E7)", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/admin/relation-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as { error: { code: string } };

    // Assert
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createRelationTypeMock).not.toHaveBeenCalled();
  });

  it("서비스가 409 RELATION_TYPE_NAME_DUPLICATE를 반환하면 그대로 전달한다(E2)", async () => {
    // Arrange
    createRelationTypeMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: { code: "RELATION_TYPE_NAME_DUPLICATE", message: "중복" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/admin/relation-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "공급" }),
    });

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: "RELATION_TYPE_NAME_DUPLICATE", message: "중복" } });
  });

  it("비인증 요청은 401을 반환한다(E5)", async () => {
    // Arrange
    const app = buildApp({ adminUser: null });

    // Act
    const res = await app.request("/admin/relation-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "공급" }),
    });

    // Assert
    expect(res.status).toBe(401);
    expect(createRelationTypeMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /admin/relation-types/:id", () => {
  beforeEach(() => {
    updateRelationTypeMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("유효 body로 요청 시 서비스 결과를 그대로 응답한다", async () => {
    // Arrange
    updateRelationTypeMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: RELATION_TYPE_ID, name: "공급(부품)", isDirected: true, isActive: false },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/relation-types/${RELATION_TYPE_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "공급(부품)", isActive: false }),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(updateRelationTypeMock).toHaveBeenCalledWith(
      expect.anything(),
      RELATION_TYPE_ID,
      { name: "공급(부품)", isActive: false },
    );
  });

  it("uuid 형식이 아닌 id는 400을 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/admin/relation-types/not-a-uuid", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(updateRelationTypeMock).not.toHaveBeenCalled();
  });

  it("필드 0개(빈 객체)면 400 VALIDATION_ERROR를 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/relation-types/${RELATION_TYPE_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as { error: { code: string } };

    // Assert
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(updateRelationTypeMock).not.toHaveBeenCalled();
  });

  it("isDirected 포함 시 400을 반환한다(R-6/BR-4)", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/relation-types/${RELATION_TYPE_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isDirected: false }),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(updateRelationTypeMock).not.toHaveBeenCalled();
  });

  it("서비스가 404 RELATION_TYPE_NOT_FOUND를 반환하면 그대로 전달한다(E6)", async () => {
    // Arrange
    updateRelationTypeMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: "RELATION_TYPE_NOT_FOUND", message: "없음" },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/relation-types/${RELATION_TYPE_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });

    // Assert
    expect(res.status).toBe(404);
  });

  it("비인증 요청은 401을 반환한다(E5)", async () => {
    // Arrange
    const app = buildApp({ adminUser: null });

    // Act
    const res = await app.request(`/admin/relation-types/${RELATION_TYPE_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });

    // Assert
    expect(res.status).toBe(401);
    expect(updateRelationTypeMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/relation-types/:id (R-3 405 스텁)", () => {
  beforeEach(() => {
    withAdminAuthMock.mockReset();
  });

  it("405 METHOD_NOT_ALLOWED를 반환하고 비활성화 유도 메시지를 포함한다(E1)", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request(`/admin/relation-types/${RELATION_TYPE_ID}`, { method: "DELETE" });
    const body = (await res.json()) as { error: { code: string; message: string } };

    // Assert
    expect(res.status).toBe(405);
    expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
    expect(body.error.message).toContain("비활성화");
  });

  it("비인증 요청도 401을 우선 반환한다(그룹 미들웨어 선적용)", async () => {
    // Arrange
    const app = buildApp({ adminUser: null });

    // Act
    const res = await app.request(`/admin/relation-types/${RELATION_TYPE_ID}`, { method: "DELETE" });

    // Assert
    expect(res.status).toBe(401);
  });
});
