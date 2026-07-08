import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";

const getChainViewMock = vi.hoisted(() => vi.fn());
const listOfficialChainCardsMock = vi.hoisted(() => vi.fn());
const listMyChainCardsMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/valuechains/backend/service", () => ({
  getChainView: getChainViewMock,
  listOfficialChainCards: listOfficialChainCardsMock,
  listMyChainCards: listMyChainCardsMock,
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

describe("GET /valuechains/official", () => {
  beforeEach(() => {
    listOfficialChainCardsMock.mockReset();
  });

  it("파라미터 없음 → 200, service는 기본값(page:1, limit:20)으로 호출된다", async () => {
    // Arrange
    listOfficialChainCardsMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], pagination: { page: 1, limit: 20, totalCount: 0, hasMore: false } },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/valuechains/official");

    // Assert
    expect(res.status).toBe(200);
    expect(listOfficialChainCardsMock).toHaveBeenCalledWith(
      expect.anything(),
      { page: 1, limit: 20 },
    );
  });

  it("page=2&limit=10 → service에 그대로 전달된다", async () => {
    // Arrange
    listOfficialChainCardsMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], pagination: { page: 2, limit: 10, totalCount: 0, hasMore: false } },
    });
    const app = buildApp();

    // Act
    await app.request("/valuechains/official?page=2&limit=10");

    // Assert
    expect(listOfficialChainCardsMock).toHaveBeenCalledWith(
      expect.anything(),
      { page: 2, limit: 10 },
    );
  });

  it("page=0(잘못된 값) → 400 VALUECHAIN_LIST_INVALID_QUERY, service 미호출", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/valuechains/official?page=0");

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALUECHAIN_LIST_INVALID_QUERY");
    expect(listOfficialChainCardsMock).not.toHaveBeenCalled();
  });

  it("limit=101(상한 초과) → 400 VALUECHAIN_LIST_INVALID_QUERY", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/valuechains/official?limit=101");

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALUECHAIN_LIST_INVALID_QUERY");
  });

  it("인증 없이도 호출 가능하다(공개 API)", async () => {
    // Arrange
    listOfficialChainCardsMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], pagination: { page: 1, limit: 20, totalCount: 0, hasMore: false } },
    });
    const app = buildApp(null);

    // Act
    const res = await app.request("/valuechains/official");

    // Assert
    expect(res.status).toBe(200);
  });

  it("service가 500을 반환하면 그대로 전달하고 details는 노출하지 않는다", async () => {
    // Arrange
    listOfficialChainCardsMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: {
        code: "VALUECHAIN_LIST_FETCH_FAILED",
        message: "조회 실패",
        details: { secret: 1 },
      },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/valuechains/official");

    // Assert
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; details?: unknown } };
    expect(body.error.code).toBe("VALUECHAIN_LIST_FETCH_FAILED");
    expect(body.error.details).toBeUndefined();
  });
});

describe("GET /valuechains/mine", () => {
  beforeEach(() => {
    listMyChainCardsMock.mockReset();
  });

  it("무세션이면 401 VALUECHAIN_LIST_UNAUTHORIZED, service 미호출 (엣지 4·7)", async () => {
    // Arrange
    const app = buildApp(null);

    // Act
    const res = await app.request("/valuechains/mine");

    // Assert
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALUECHAIN_LIST_UNAUTHORIZED");
    expect(listMyChainCardsMock).not.toHaveBeenCalled();
  });

  it("유효 세션이면 service에 userId를 전달하고 200을 반환한다", async () => {
    // Arrange
    listMyChainCardsMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], pagination: { page: 1, limit: 20, totalCount: 0, hasMore: false } },
    });
    const app = buildApp({ id: "user-1" });

    // Act
    const res = await app.request("/valuechains/mine");

    // Assert
    expect(res.status).toBe(200);
    expect(listMyChainCardsMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      { page: 1, limit: 20 },
    );
  });

  it("파라미터 검증은 인증 확인 이전에 발생하지 않는다 — 무세션+잘못된 쿼리도 401 우선", async () => {
    // Arrange
    const app = buildApp(null);

    // Act
    const res = await app.request("/valuechains/mine?page=abc");

    // Assert
    expect(res.status).toBe(401);
  });

  it("유효 세션 + 잘못된 쿼리(page=0) → 400 VALUECHAIN_LIST_INVALID_QUERY", async () => {
    // Arrange
    const app = buildApp({ id: "user-1" });

    // Act
    const res = await app.request("/valuechains/mine?page=0");

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALUECHAIN_LIST_INVALID_QUERY");
    expect(listMyChainCardsMock).not.toHaveBeenCalled();
  });

  it("0건 응답도 200으로 정상 처리한다(엣지 2)", async () => {
    // Arrange
    listMyChainCardsMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], pagination: { page: 1, limit: 20, totalCount: 0, hasMore: false } },
    });
    const app = buildApp({ id: "user-1" });

    // Act
    const res = await app.request("/valuechains/mine");

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { items: unknown[] } };
    expect(body.data.items).toEqual([]);
  });
});
