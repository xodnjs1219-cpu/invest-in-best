import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";
import { valuechainsErrorCodes } from "@/features/valuechains/backend/error";

const cloneOfficialChainMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/valuechains/backend/service", async () => {
  const actual = await vi.importActual<typeof import("@/features/valuechains/backend/service")>(
    "@/features/valuechains/backend/service",
  );
  return {
    ...actual,
    cloneOfficialChain: cloneOfficialChainMock,
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

describe("POST /valuechains/:chainId/clone", () => {
  beforeEach(() => {
    cloneOfficialChainMock.mockReset();
  });

  it("로그인 사용자 + 유효한 chainId → service 호출 후 201 응답", async () => {
    cloneOfficialChainMock.mockResolvedValue({
      ok: true,
      status: 201,
      data: { chainId: "new-chain", name: "반도체" },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/clone`, { method: "POST" });

    expect(res.status).toBe(201);
    expect(cloneOfficialChainMock).toHaveBeenCalledWith(expect.anything(), "user-1", VALID_CHAIN_ID);
    const body = await res.json();
    expect(body.data.chainId).toBe("new-chain");
  });

  it("비로그인 → 401 UNAUTHORIZED, service 미호출", async () => {
    const app = buildApp(null);

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/clone`, { method: "POST" });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe(valuechainsErrorCodes.unauthorized);
    expect(cloneOfficialChainMock).not.toHaveBeenCalled();
  });

  it("uuid 형식이 아닌 chainId → 400 INVALID_PARAMS, service 미호출", async () => {
    const app = buildApp();

    const res = await app.request("/valuechains/not-a-uuid/clone", { method: "POST" });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe(valuechainsErrorCodes.invalidParams);
    expect(cloneOfficialChainMock).not.toHaveBeenCalled();
  });

  it("service 실패(409) → 그대로 전달", async () => {
    cloneOfficialChainMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: { code: valuechainsErrorCodes.chainLimitExceeded, message: "상한 도달" },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/clone`, { method: "POST" });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe(valuechainsErrorCodes.chainLimitExceeded);
  });
});
