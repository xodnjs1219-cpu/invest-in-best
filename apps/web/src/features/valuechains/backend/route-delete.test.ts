import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";
import { valuechainsErrorCodes } from "@/features/valuechains/backend/error";

const deleteUserChainMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/valuechains/backend/service", async () => {
  const actual = await vi.importActual<typeof import("@/features/valuechains/backend/service")>(
    "@/features/valuechains/backend/service",
  );
  return {
    ...actual,
    deleteUserChain: deleteUserChainMock,
  };
});

const { registerValuechainsRoutes } = await import("@/features/valuechains/backend/route");

const VALID_CHAIN_ID = "11111111-1111-4111-8111-111111111111";

const buildApp = (user: { id: string } | null = { id: "user-1" }) => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", { mocked: "supabase" } as never);
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
  registerValuechainsRoutes(app);
  return app;
};

describe("DELETE /valuechains/:chainId", () => {
  beforeEach(() => {
    deleteUserChainMock.mockReset();
  });

  it("소유자가 본인 체인 삭제 → 204 무본문 응답", async () => {
    deleteUserChainMock.mockResolvedValue({ ok: true, status: 204, data: null });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`, { method: "DELETE" });

    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe("");
    expect(deleteUserChainMock).toHaveBeenCalledWith(expect.anything(), "user-1", VALID_CHAIN_ID);
  });

  it("비로그인 → 401 UNAUTHORIZED, service 미호출", async () => {
    const app = buildApp(null);

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`, { method: "DELETE" });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe(valuechainsErrorCodes.unauthorized);
    expect(deleteUserChainMock).not.toHaveBeenCalled();
  });

  it("uuid 형식이 아닌 chainId → 400 VALIDATION_ERROR, service 미호출", async () => {
    const app = buildApp();

    const res = await app.request("/valuechains/not-a-uuid", { method: "DELETE" });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe(valuechainsErrorCodes.validationError);
    expect(deleteUserChainMock).not.toHaveBeenCalled();
  });

  it("공식 체인 삭제 시도(403) → 그대로 전달, 본문 있음", async () => {
    deleteUserChainMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: { code: valuechainsErrorCodes.officialChainDeleteForbidden, message: "공식 체인은 삭제할 수 없습니다." },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`, { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe(valuechainsErrorCodes.officialChainDeleteForbidden);
  });

  it("타인 체인 삭제 시도(403 CHAIN_FORBIDDEN) → 그대로 전달", async () => {
    deleteUserChainMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: { code: valuechainsErrorCodes.chainForbidden, message: "권한이 없습니다." },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`, { method: "DELETE" });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe(valuechainsErrorCodes.chainForbidden);
  });

  it("서버 오류(500) → 그대로 전달", async () => {
    deleteUserChainMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: { code: valuechainsErrorCodes.internalError, message: "삭제 실패" },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`, { method: "DELETE" });

    expect(res.status).toBe(500);
  });
});
