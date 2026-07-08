import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const saveUserChainMock = vi.hoisted(() => vi.fn());
const createOfficialChainMock = vi.hoisted(() => vi.fn());
const updateOfficialChainMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/valuechains/backend/service", () => ({
  saveUserChain: saveUserChainMock,
  createOfficialChain: createOfficialChainMock,
  updateOfficialChain: updateOfficialChainMock,
}));

vi.mock("@/features/account/backend/repository", () => ({
  findRoleByUserId: vi.fn().mockResolvedValue({ id: "user-1", role: "user" }),
}));

vi.mock("@/features/valuechains/backend/repository", async () => {
  const actual = await vi.importActual<typeof import("@/features/valuechains/backend/repository")>(
    "@/features/valuechains/backend/repository",
  );
  return {
    ...actual,
    createValuechainsSaveRepository: vi.fn(() => ({
      findChainMetaById: vi.fn().mockResolvedValue(null),
    })),
  };
});

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

const buildBody = () => ({
  name: "나의 체인",
  focusType: "industry",
  focusSecurityId: null,
  baseSnapshotId: null,
  groups: [],
  nodes: [],
  edges: [],
});

describe("POST /valuechains", () => {
  beforeEach(() => {
    saveUserChainMock.mockReset();
  });

  it("미로그인 호출 → 401 AUTH_REQUIRED", async () => {
    const app = buildApp(null);
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify(buildBody()),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(401);
    expect(saveUserChainMock).not.toHaveBeenCalled();
  });

  it("chainType='official' → createOfficialChain으로 위임, saveUserChain 미호출(회귀 — R-2)", async () => {
    createOfficialChainMock.mockResolvedValue({ ok: true, status: 201, data: { chainId: "c1" } });
    const app = buildApp({ id: "user-1" });
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify({ ...buildBody(), chainType: "official" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(201);
    expect(createOfficialChainMock).toHaveBeenCalled();
    expect(saveUserChainMock).not.toHaveBeenCalled();
  });

  it("로그인 + 유효 페이로드 → saveUserChain 호출, 201 응답 전달", async () => {
    saveUserChainMock.mockResolvedValue({ ok: true, status: 201, data: { chainId: "c1" } });
    const app = buildApp({ id: "user-1" });
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify(buildBody()),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(201);
    expect(saveUserChainMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "user-1", chainId: null }),
    );
  });

  it("name 누락/공백 body → 400 VALUECHAINS.INVALID_REQUEST", async () => {
    const app = buildApp({ id: "user-1" });
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify({ ...buildBody(), name: "" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALUECHAINS.INVALID_REQUEST");
  });
});

describe("PUT /valuechains/:chainId", () => {
  beforeEach(() => {
    saveUserChainMock.mockReset();
  });

  it("미로그인 호출 → 401", async () => {
    const app = buildApp(null);
    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`, {
      method: "PUT",
      body: JSON.stringify({ ...buildBody(), baseSnapshotId: VALID_CHAIN_ID }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("baseSnapshotId: null → 400 (스키마 통과 후 service가 거부 — mock에서 400 반환 시뮬레이션)", async () => {
    saveUserChainMock.mockResolvedValue({
      ok: false,
      status: 400,
      error: { code: "VALUECHAINS.INVALID_REQUEST", message: "필요" },
    });
    const app = buildApp({ id: "user-1" });
    const res = await app.request(`/valuechains/${VALID_CHAIN_ID}`, {
      method: "PUT",
      body: JSON.stringify(buildBody()),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("uuid 형식 오류 param → 400", async () => {
    const app = buildApp({ id: "user-1" });
    const res = await app.request("/valuechains/not-a-uuid", {
      method: "PUT",
      body: JSON.stringify(buildBody()),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });
});
