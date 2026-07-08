import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const getChainViewMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/valuechains/backend/service", () => ({
  getChainView: getChainViewMock,
}));

const { registerValuechainsRoutes } = await import("@/features/valuechains/backend/route");

const VALID_CHAIN_ID = "11111111-1111-4111-8111-111111111111";

const buildApp = (user: { id: string } | null = null) => {
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

describe("GET /valuechains/:chainId", () => {
  beforeEach(() => {
    getChainViewMock.mockReset();
  });

  it("유효 UUID + 서비스 성공 → 200과 데이터를 반환한다", async () => {
    // Arrange
    getChainViewMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { chain: { id: VALID_CHAIN_ID } },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { chain: { id: VALID_CHAIN_ID } } });
    expect(getChainViewMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_CHAIN_ID,
      null,
    );
  });

  it("UUID 형식이 아니면 400 INVALID_CHAIN_ID를 반환하고 서비스는 호출하지 않는다 (E12)", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/valuechains/not-a-uuid");

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CHAIN_ID");
    expect(getChainViewMock).not.toHaveBeenCalled();
  });

  it("로그인 사용자면 currentUserId를 서비스에 전달한다", async () => {
    // Arrange
    getChainViewMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { chain: { id: VALID_CHAIN_ID, isOwner: true } },
    });
    const app = buildApp({ id: "user-1" });

    // Act
    await app.request(`/valuechains/${VALID_CHAIN_ID}`);

    // Assert
    expect(getChainViewMock).toHaveBeenCalledWith(expect.anything(), VALID_CHAIN_ID, "user-1");
  });

  it("서비스가 404를 반환하면 그대로 전달한다", async () => {
    // Arrange
    getChainViewMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: "CHAIN_NOT_FOUND", message: "체인을 찾을 수 없습니다." },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`);

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "CHAIN_NOT_FOUND", message: "체인을 찾을 수 없습니다." },
    });
  });

  it("서비스가 500 SNAPSHOT_MISSING을 반환해도 body에는 details를 노출하지 않는다", async () => {
    // Arrange
    getChainViewMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: { code: "SNAPSHOT_MISSING", message: "스냅샷을 찾을 수 없습니다.", details: { secret: 1 } },
    });
    const app = buildApp();

    // Act
    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`);

    // Assert
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; details?: unknown } };
    expect(body.error.code).toBe("SNAPSHOT_MISSING");
    expect(body.error.details).toBeUndefined();
  });
});
