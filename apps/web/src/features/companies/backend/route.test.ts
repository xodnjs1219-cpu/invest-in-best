import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv, AuthUser } from "@/backend/hono/context";
import { companiesErrorCodes } from "@/features/companies/backend/error";

const getCompanySummaryMock = vi.hoisted(() => vi.fn());
const getFinancialsMock = vi.hoisted(() => vi.fn());
const getDisclosuresMock = vi.hoisted(() => vi.fn());
const getQuotesMock = vi.hoisted(() => vi.fn());
const getBelongingChainsMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/companies/backend/service", () => ({
  getCompanySummary: getCompanySummaryMock,
  getFinancials: getFinancialsMock,
  getDisclosures: getDisclosuresMock,
  getQuotes: getQuotesMock,
  getBelongingChains: getBelongingChainsMock,
}));

const { registerCompaniesRoutes } = await import("@/features/companies/backend/route");

const buildApp = (user: AuthUser | null = null) => {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("supabase", {} as never);
    c.set("logger", { debug() {}, info() {}, warn() {}, error() {} });
    c.set("user", user);
    c.set("config", {
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
      supabaseServiceRoleKey: "service-role",
      adminSeedEmails: [],
      origin: "https://app.example.com",
    });
    await next();
  });
  registerCompaniesRoutes(app);
  return app;
};

const SECURITY_ID = "22222222-2222-4222-8222-222222222222";

describe("GET /companies/:ticker", () => {
  beforeEach(() => {
    getCompanySummaryMock.mockReset();
  });

  it("유효한 티커면 200 + service 결과를 그대로 응답한다", async () => {
    getCompanySummaryMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: { security: { id: SECURITY_ID } },
    });
    const app = buildApp();

    const res = await app.request("/companies/005930");

    expect(res.status).toBe(200);
    expect(getCompanySummaryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ticker: "005930" }),
    );
  });

  it("market 쿼리를 service에 전달한다", async () => {
    getCompanySummaryMock.mockResolvedValue({ ok: true, status: 200, data: {} });
    const app = buildApp();

    await app.request("/companies/AAPL?market=US");

    expect(getCompanySummaryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ticker: "AAPL", market: "US" }),
    );
  });

  it("market='JP'면 400 INVALID_REQUEST를 반환하고 service를 호출하지 않는다", async () => {
    const app = buildApp();

    const res = await app.request("/companies/005930?market=JP");

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe(companiesErrorCodes.invalidRequest);
    expect(getCompanySummaryMock).not.toHaveBeenCalled();
  });

  it("service가 404를 반환하면 그대로 응답한다", async () => {
    getCompanySummaryMock.mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: companiesErrorCodes.companyNotFound, message: "not found" },
    });
    const app = buildApp();

    const res = await app.request("/companies/NOPE");

    expect(res.status).toBe(404);
  });

  it("service가 409를 반환하면 그대로 응답한다(E4)", async () => {
    getCompanySummaryMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: { code: companiesErrorCodes.tickerAmbiguous, message: "ambiguous" },
    });
    const app = buildApp();

    const res = await app.request("/companies/005930");

    expect(res.status).toBe(409);
  });
});

describe("GET /securities/:securityId/financials", () => {
  beforeEach(() => {
    getFinancialsMock.mockReset();
  });

  it("유효한 securityId면 200 응답", async () => {
    getFinancialsMock.mockResolvedValue({ ok: true, status: 200, data: { items: [] } });
    const app = buildApp();

    const res = await app.request(`/securities/${SECURITY_ID}/financials`);

    expect(res.status).toBe(200);
    expect(getFinancialsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ securityId: SECURITY_ID }),
    );
  });

  it("securityId가 UUID가 아니면 400을 반환한다", async () => {
    const app = buildApp();

    const res = await app.request("/securities/not-a-uuid/financials");

    expect(res.status).toBe(400);
    expect(getFinancialsMock).not.toHaveBeenCalled();
  });

  it("fromYear/toYear를 query로 전달한다", async () => {
    getFinancialsMock.mockResolvedValue({ ok: true, status: 200, data: {} });
    const app = buildApp();

    await app.request(`/securities/${SECURITY_ID}/financials?fromYear=2020&toYear=2024`);

    expect(getFinancialsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ query: { fromYear: 2020, toYear: 2024 } }),
    );
  });
});

describe("GET /securities/:securityId/disclosures", () => {
  beforeEach(() => {
    getDisclosuresMock.mockReset();
  });

  it("page를 query로 전달한다", async () => {
    getDisclosuresMock.mockResolvedValue({ ok: true, status: 200, data: {} });
    const app = buildApp();

    await app.request(`/securities/${SECURITY_ID}/disclosures?page=2`);

    expect(getDisclosuresMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 2 }),
    );
  });

  it("page 미지정 시 기본값 1로 호출한다", async () => {
    getDisclosuresMock.mockResolvedValue({ ok: true, status: 200, data: {} });
    const app = buildApp();

    await app.request(`/securities/${SECURITY_ID}/disclosures`);

    expect(getDisclosuresMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 1 }),
    );
  });
});

describe("GET /securities/:securityId/quotes", () => {
  beforeEach(() => {
    getQuotesMock.mockReset();
  });

  it("from/to를 query로 전달하고 today를 함께 주입한다", async () => {
    getQuotesMock.mockResolvedValue({ ok: true, status: 200, data: {} });
    const app = buildApp();

    await app.request(`/securities/${SECURITY_ID}/quotes?from=2026-01-01&to=2026-07-01`);

    expect(getQuotesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: { from: "2026-01-01", to: "2026-07-01" },
        today: expect.any(String),
      }),
    );
  });

  it("잘못된 날짜 형식이면 400을 반환한다", async () => {
    const app = buildApp();

    const res = await app.request(`/securities/${SECURITY_ID}/quotes?from=2026-2-3`);

    expect(res.status).toBe(400);
    expect(getQuotesMock).not.toHaveBeenCalled();
  });
});

describe("GET /securities/:securityId/valuechains", () => {
  beforeEach(() => {
    getBelongingChainsMock.mockReset();
  });

  it("비로그인이면 currentUserId: null로 호출한다", async () => {
    getBelongingChainsMock.mockResolvedValue({ ok: true, status: 200, data: { items: [] } });
    const app = buildApp(null);

    await app.request(`/securities/${SECURITY_ID}/valuechains`);

    expect(getBelongingChainsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ currentUserId: null }),
    );
  });

  it("로그인 상태면 currentUserId에 사용자 id를 전달한다", async () => {
    getBelongingChainsMock.mockResolvedValue({ ok: true, status: 200, data: { items: [] } });
    const app = buildApp({ id: "user-1" });

    await app.request(`/securities/${SECURITY_ID}/valuechains`);

    expect(getBelongingChainsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ currentUserId: "user-1" }),
    );
  });
});
