import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/backend/hono/context";
import { securitiesSearchErrorCodes } from "@/features/securities/backend/error";

const searchSecuritiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/securities/backend/service", () => ({
  searchSecurities: searchSecuritiesMock,
}));

const { registerSecuritiesRoutes } = await import("@/features/securities/backend/route");

const buildApp = () => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", {} as never);
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
  registerSecuritiesRoutes(app);
  return app;
};

describe("GET /securities/search", () => {
  beforeEach(() => {
    searchSecuritiesMock.mockReset();
  });

  it("유효한 쿼리로 요청 시 service 결과를 그대로 200으로 응답한다", async () => {
    // Arrange
    searchSecuritiesMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], page: 1, pageSize: 20, hasMore: false },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/securities/search?q=삼성");

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { items: [], page: 1, pageSize: 20, hasMore: false },
    });
    expect(searchSecuritiesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ q: "삼성", page: 1 }),
    );
  });

  it("q 누락 시 400 INVALID_QUERY를 반환하고 service는 호출하지 않는다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/securities/search");

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(securitiesSearchErrorCodes.invalidQuery);
    expect(searchSecuritiesMock).not.toHaveBeenCalled();
  });

  it("q가 빈 값이면 400 INVALID_QUERY를 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/securities/search?q=");

    // Assert
    expect(res.status).toBe(400);
  });

  it("market이 잘못된 enum이면 400 INVALID_QUERY를 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/securities/search?q=삼성&market=JP");

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(securitiesSearchErrorCodes.invalidQuery);
  });

  it("page=0이면 400 INVALID_QUERY를 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/securities/search?q=삼성&page=0");

    // Assert
    expect(res.status).toBe(400);
  });

  it("page=abc이면 400 INVALID_QUERY를 반환한다", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await app.request("/securities/search?q=삼성&page=abc");

    // Assert
    expect(res.status).toBe(400);
  });

  it("page 미지정 시 page=1로 동작한다", async () => {
    // Arrange
    searchSecuritiesMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], page: 1, pageSize: 20, hasMore: false },
    });
    const app = buildApp();

    // Act
    await app.request("/securities/search?q=삼성");

    // Assert
    expect(searchSecuritiesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 1 }),
    );
  });

  it("market=KRX 지정 시 service에 market:'KRX'가 전달된다", async () => {
    // Arrange
    searchSecuritiesMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], page: 1, pageSize: 20, hasMore: false },
    });
    const app = buildApp();

    // Act
    await app.request("/securities/search?q=삼성&market=KRX");

    // Assert
    expect(searchSecuritiesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ market: "KRX" }),
    );
  });

  it("service가 500 SEARCH_FAILED를 반환하면 그대로 응답한다", async () => {
    // Arrange
    searchSecuritiesMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: { code: securitiesSearchErrorCodes.searchFailed, message: "DB 오류" },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/securities/search?q=삼성");

    // Assert
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(securitiesSearchErrorCodes.searchFailed);
  });

  it("비로그인(쿠키 없음) 호출도 200으로 정상 동작한다(공개 API)", async () => {
    // Arrange
    searchSecuritiesMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { items: [], page: 1, pageSize: 20, hasMore: false },
    });
    const app = buildApp();

    // Act
    const res = await app.request("/securities/search?q=삼성");

    // Assert
    expect(res.status).toBe(200);
  });
});
