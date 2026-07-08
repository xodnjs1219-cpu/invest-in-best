import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const listAdminChainsMock = vi.hoisted(() => vi.fn());
const archiveChainMock = vi.hoisted(() => vi.fn());
const withAdminAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/admin-valuechains/backend/service", () => ({
  listAdminChains: listAdminChainsMock,
  archiveChain: archiveChainMock,
}));

const ADMIN_USER = { id: "admin-1", email: "admin@example.com" };

vi.mock("@/backend/middleware/admin", () => ({
  withAdminAuth: () => withAdminAuthMock,
  adminAuthErrorCodes: { unauthorized: "UNAUTHORIZED", adminOnly: "ADMIN_ONLY" },
}));

const { registerAdminValuechainRoutes } = await import("@/features/admin-valuechains/backend/route");

const CHAIN_ID = "11111111-1111-4111-8111-111111111111";

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
  registerAdminValuechainRoutes(app);
  return app;
};

describe("GET /admin/valuechains", () => {
  beforeEach(() => {
    listAdminChainsMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("비로그인 호출(E1) → 401 UNAUTHORIZED", async () => {
    const app = buildApp({ adminUser: null });
    const res = await app.request("/admin/valuechains");
    expect(res.status).toBe(401);
    expect(listAdminChainsMock).not.toHaveBeenCalled();
  });

  it("Admin GET → 200, listAdminChains 호출", async () => {
    listAdminChainsMock.mockResolvedValue({ ok: true, status: 200, data: { chains: [] } });
    const app = buildApp();
    const res = await app.request("/admin/valuechains");
    expect(res.status).toBe(200);
    expect(listAdminChainsMock).toHaveBeenCalledWith(expect.anything(), { includeArchived: true });
  });

  it("?includeArchived=false → includeArchived:false로 서비스 호출", async () => {
    listAdminChainsMock.mockResolvedValue({ ok: true, status: 200, data: { chains: [] } });
    const app = buildApp();
    await app.request("/admin/valuechains?includeArchived=false");
    expect(listAdminChainsMock).toHaveBeenCalledWith(expect.anything(), { includeArchived: false });
  });

  it("시드 미존재(공식 체인 0건, E5) → 200 + chains: []", async () => {
    listAdminChainsMock.mockResolvedValue({ ok: true, status: 200, data: { chains: [] } });
    const app = buildApp();
    const res = await app.request("/admin/valuechains");
    const body = await res.json();
    expect(body.data.chains).toEqual([]);
  });

  it("uuid 형식 오류 무관 — 쿼리 오류 시 400", async () => {
    const app = buildApp();
    const res = await app.request("/admin/valuechains?includeArchived=banana");
    expect(res.status).toBe(400);
  });
});

describe("DELETE /admin/valuechains/:chainId", () => {
  beforeEach(() => {
    archiveChainMock.mockReset();
    withAdminAuthMock.mockReset();
  });

  it("비로그인 호출 → 401", async () => {
    const app = buildApp({ adminUser: null });
    const res = await app.request(`/admin/valuechains/${CHAIN_ID}`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("Admin이 활성 공식 체인 DELETE → 200 {isArchived: true}", async () => {
    archiveChainMock.mockResolvedValue({ ok: true, status: 200, data: { chainId: CHAIN_ID, isArchived: true } });
    const app = buildApp();
    const res = await app.request(`/admin/valuechains/${CHAIN_ID}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.isArchived).toBe(true);
  });

  it("동일 체인 DELETE 재호출(E8) → 200 멱등", async () => {
    archiveChainMock.mockResolvedValue({ ok: true, status: 200, data: { chainId: CHAIN_ID, isArchived: true } });
    const app = buildApp();
    const res1 = await app.request(`/admin/valuechains/${CHAIN_ID}`, { method: "DELETE" });
    const res2 = await app.request(`/admin/valuechains/${CHAIN_ID}`, { method: "DELETE" });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("미존재/user 체인 chainId → 404", async () => {
    archiveChainMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: "ADMIN_CHAINS.CHAIN_NOT_FOUND", message: "찾을 수 없음" },
    });
    const app = buildApp();
    const res = await app.request(`/admin/valuechains/${CHAIN_ID}`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("uuid 형식 오류 param → 400", async () => {
    const app = buildApp();
    const res = await app.request("/admin/valuechains/not-a-uuid", { method: "DELETE" });
    expect(res.status).toBe(400);
    expect(archiveChainMock).not.toHaveBeenCalled();
  });
});
