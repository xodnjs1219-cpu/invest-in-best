import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";
import { valuechainsErrorCodes } from "@/features/valuechains/backend/error";

const getLatestSnapshotForEditMock = vi.hoisted(() => vi.fn());
const findRoleByUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/valuechains/backend/service", async () => {
  const actual = await vi.importActual<typeof import("@/features/valuechains/backend/service")>(
    "@/features/valuechains/backend/service",
  );
  return {
    ...actual,
    getLatestSnapshotForEdit: getLatestSnapshotForEditMock,
  };
});

vi.mock("@/features/account/backend/repository", () => ({
  findRoleByUserId: findRoleByUserIdMock,
}));

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

describe("GET /valuechains/:chainId/snapshots/latest", () => {
  beforeEach(() => {
    getLatestSnapshotForEditMock.mockReset();
    findRoleByUserIdMock.mockReset();
  });

  it("소유자가 본인 체인으로 호출 → 200, snapshotId/nodes/edges/groups/메타 포함", async () => {
    getLatestSnapshotForEditMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { chainId: VALID_CHAIN_ID, snapshotId: "snap1", nodes: [], edges: [], groups: [] },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshots/latest`);

    expect(res.status).toBe(200);
    expect(getLatestSnapshotForEditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      VALID_CHAIN_ID,
      "user-1",
    );
  });

  it("uuid 형식이 아닌 chainId → 400", async () => {
    const app = buildApp();

    const res = await app.request("/valuechains/not-a-uuid/snapshots/latest");

    expect(res.status).toBe(400);
    expect(getLatestSnapshotForEditMock).not.toHaveBeenCalled();
  });

  it("미로그인 → 401", async () => {
    const app = buildApp(null);

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshots/latest`);

    expect(res.status).toBe(401);
    expect(getLatestSnapshotForEditMock).not.toHaveBeenCalled();
  });

  it("타인 사용자 체인으로 호출 → 404 CHAIN_NOT_FOUND(403 아님, R-2)", async () => {
    getLatestSnapshotForEditMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: valuechainsErrorCodes.chainNotFound, message: "체인을 찾을 수 없습니다." },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshots/latest`);

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(valuechainsErrorCodes.chainNotFound);
  });

  it("일반 사용자가 공식 체인으로 호출 → 403 CHAIN_FORBIDDEN", async () => {
    getLatestSnapshotForEditMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: { code: valuechainsErrorCodes.editChainForbidden, message: "관리자 권한이 필요합니다." },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshots/latest`);

    expect(res.status).toBe(403);
  });

  it("미존재/보관 체인 → 404", async () => {
    getLatestSnapshotForEditMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: valuechainsErrorCodes.chainNotFound, message: "체인을 찾을 수 없습니다." },
    });
    const app = buildApp();

    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}/snapshots/latest`);

    expect(res.status).toBe(404);
  });
});
