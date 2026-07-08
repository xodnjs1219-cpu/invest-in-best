import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const saveUserChainMock = vi.hoisted(() => vi.fn());
const createOfficialChainMock = vi.hoisted(() => vi.fn());
const updateOfficialChainMock = vi.hoisted(() => vi.fn());
const findRoleByUserIdMock = vi.hoisted(() => vi.fn());
const findChainMetaByIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/valuechains/backend/service", () => ({
  saveUserChain: saveUserChainMock,
  createOfficialChain: createOfficialChainMock,
  updateOfficialChain: updateOfficialChainMock,
}));

vi.mock("@/features/account/backend/repository", () => ({
  findRoleByUserId: findRoleByUserIdMock,
}));

vi.mock("@/features/valuechains/backend/repository", async () => {
  const actual = await vi.importActual<typeof import("@/features/valuechains/backend/repository")>(
    "@/features/valuechains/backend/repository",
  );
  return {
    ...actual,
    createValuechainsSaveRepository: vi.fn(() => ({
      findChainMetaById: findChainMetaByIdMock,
    })),
  };
});

const { registerValuechainsRoutes } = await import("@/features/valuechains/backend/route");

const CHAIN_ID = "11111111-1111-4111-8111-111111111111";
const SNAPSHOT_ID = "22222222-2222-4222-8222-222222222222";

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

const buildBody = (overrides: Record<string, unknown> = {}) => ({
  name: "반도체 밸류체인",
  focusType: "industry",
  focusSecurityId: null,
  baseSnapshotId: null,
  disclosureDate: null,
  groups: [],
  nodes: [],
  edges: [],
  ...overrides,
});

describe("POST /valuechains (official 분기)", () => {
  beforeEach(() => {
    saveUserChainMock.mockReset();
    createOfficialChainMock.mockReset();
    updateOfficialChainMock.mockReset();
    findRoleByUserIdMock.mockReset();
    findChainMetaByIdMock.mockReset();
    findChainMetaByIdMock.mockResolvedValue(null);
  });

  it("Admin이 chainType='official' 유효 페이로드로 POST → 201 응답 전달", async () => {
    findRoleByUserIdMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    createOfficialChainMock.mockResolvedValue({
      ok: true,
      status: 201,
      data: { chainId: CHAIN_ID, snapshotId: SNAPSHOT_ID, effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 },
    });

    const app = buildApp({ id: "admin-1" });
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify({ ...buildBody(), chainType: "official" }),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(201);
    expect(createOfficialChainMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "admin-1", role: "admin" }),
      expect.anything(),
    );
  });

  it("일반 사용자가 chainType=official로 POST(E1) → createOfficialChain이 403 반환", async () => {
    findRoleByUserIdMock.mockResolvedValue({ id: "user-1", role: "user" });
    createOfficialChainMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: { code: "VALUECHAINS.ADMIN_REQUIRED", message: "관리자 권한이 필요합니다." },
    });

    const app = buildApp({ id: "user-1" });
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify({ ...buildBody(), chainType: "official" }),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(403);
  });

  it("비로그인 POST(E12) → 401, service 미호출", async () => {
    const app = buildApp(null);
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify({ ...buildBody(), chainType: "official" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(401);
    expect(createOfficialChainMock).not.toHaveBeenCalled();
  });

  it("chainType 미지정 POST → user 분기로 디스패치(saveUserChain 호출, createOfficialChain 미호출)", async () => {
    saveUserChainMock.mockResolvedValue({
      ok: true,
      status: 201,
      data: { chainId: CHAIN_ID, snapshotId: SNAPSHOT_ID, effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 },
    });
    const app = buildApp({ id: "user-1" });
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify(buildBody()),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(201);
    expect(saveUserChainMock).toHaveBeenCalled();
    expect(createOfficialChainMock).not.toHaveBeenCalled();
  });

  it("chainType:'banana' → 400", async () => {
    const app = buildApp({ id: "user-1" });
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify({ ...buildBody(), chainType: "banana" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("필수 필드 누락(official 분기) → 400 VALUECHAINS.INVALID_REQUEST", async () => {
    findRoleByUserIdMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    const app = buildApp({ id: "admin-1" });
    const res = await app.request("/valuechains", {
      method: "POST",
      body: JSON.stringify({ chainType: "official", name: "" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
    expect(createOfficialChainMock).not.toHaveBeenCalled();
  });
});

describe("PUT /valuechains/:chainId (official 분기)", () => {
  beforeEach(() => {
    saveUserChainMock.mockReset();
    createOfficialChainMock.mockReset();
    updateOfficialChainMock.mockReset();
    findRoleByUserIdMock.mockReset();
    findChainMetaByIdMock.mockReset();
  });

  it("대상 체인이 official → updateOfficialChain 위임", async () => {
    findChainMetaByIdMock.mockResolvedValue({ id: CHAIN_ID, chain_type: "official", owner_id: null, is_archived: false });
    findRoleByUserIdMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    updateOfficialChainMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { chainId: CHAIN_ID, snapshotId: SNAPSHOT_ID, effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 },
    });

    const app = buildApp({ id: "admin-1" });
    const res = await app.request(`/valuechains/${CHAIN_ID}`, {
      method: "PUT",
      body: JSON.stringify(buildBody({ baseSnapshotId: SNAPSHOT_ID })),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(200);
    expect(updateOfficialChainMock).toHaveBeenCalled();
    expect(saveUserChainMock).not.toHaveBeenCalled();
  });

  it("대상 체인이 user → saveUserChain 위임(updateOfficialChain 미호출)", async () => {
    findChainMetaByIdMock.mockResolvedValue({ id: CHAIN_ID, chain_type: "user", owner_id: "user-1", is_archived: false });
    saveUserChainMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { chainId: CHAIN_ID, snapshotId: SNAPSHOT_ID, effectiveAt: "2026", nodeCount: 0, edgeCount: 0, groupCount: 0 },
    });

    const app = buildApp({ id: "user-1" });
    const res = await app.request(`/valuechains/${CHAIN_ID}`, {
      method: "PUT",
      body: JSON.stringify(buildBody({ baseSnapshotId: SNAPSHOT_ID })),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(200);
    expect(saveUserChainMock).toHaveBeenCalled();
    expect(updateOfficialChainMock).not.toHaveBeenCalled();
  });

  it("보관 체인 PUT(E10) → updateOfficialChain이 409 반환", async () => {
    findChainMetaByIdMock.mockResolvedValue({ id: CHAIN_ID, chain_type: "official", owner_id: null, is_archived: true });
    findRoleByUserIdMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    updateOfficialChainMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: { code: "VALUECHAINS.CHAIN_ARCHIVED", message: "보관됨" },
    });

    const app = buildApp({ id: "admin-1" });
    const res = await app.request(`/valuechains/${CHAIN_ID}`, {
      method: "PUT",
      body: JSON.stringify(buildBody({ baseSnapshotId: SNAPSHOT_ID })),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(409);
  });
});
