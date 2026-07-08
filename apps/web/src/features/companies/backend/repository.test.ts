import { describe, expect, it, vi } from "vitest";
import { createCompaniesRepository } from "@/features/companies/backend/repository";

/** 체인형 Supabase 쿼리 빌더를 모킹하는 헬퍼 — 각 단계 호출을 기록하고 마지막에 결과를 준다. */
const createQueryBuilderMock = (result: { data: unknown; error: unknown }) => {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  builder.select = record("select");
  builder.eq = record("eq");
  builder.gte = record("gte");
  builder.lte = record("lte");
  builder.order = record("order");
  builder.limit = record("limit");
  builder.range = record("range");
  builder.maybeSingle = vi.fn(async () => result);
  // limit()/order()/range() 체인의 최종 then (배열 결과) — thenable 지원
  builder.then = (resolve: (value: unknown) => void) => resolve(result);
  return { builder, calls };
};

describe("createCompaniesRepository", () => {
  describe("findSecuritiesByTicker", () => {
    it("market이 null이면 market 필터 없이 조회한다", async () => {
      const { builder, calls } = createQueryBuilderMock({ data: [], error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findSecuritiesByTicker("005930", null);

      expect(client.from).toHaveBeenCalledWith("securities");
      expect(calls).toContainEqual({ method: "eq", args: ["ticker", "005930"] });
      expect(calls.some((c) => c.method === "eq" && c.args[0] === "market")).toBe(false);
      expect(result).toEqual({ ok: true, data: [] });
    });

    it("market이 'US'면 market 필터를 추가한다", async () => {
      const { builder, calls } = createQueryBuilderMock({ data: [], error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      await repo.findSecuritiesByTicker("AAPL", "US");

      expect(calls).toContainEqual({ method: "eq", args: ["market", "US"] });
    });

    it("0행이면 에러가 아니라 빈 배열을 반환한다", async () => {
      const { builder } = createQueryBuilderMock({ data: [], error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findSecuritiesByTicker("NOPE", null);

      expect(result).toEqual({ ok: true, data: [] });
    });

    it("Supabase 오류 시 { ok: false, message }를 반환한다(예외 미전파)", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: { message: "db down" } });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findSecuritiesByTicker("005930", null);

      expect(result).toEqual({ ok: false, message: "db down" });
    });
  });

  describe("findSecurityById", () => {
    it("id로 단건 조회 후 존재하면 data를 반환한다", async () => {
      const row = { id: "sec-1", ticker: "005930" };
      const { builder, calls } = createQueryBuilderMock({ data: row, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findSecurityById("sec-1");

      expect(client.from).toHaveBeenCalledWith("securities");
      expect(calls).toContainEqual({ method: "eq", args: ["id", "sec-1"] });
      expect(result).toEqual({ ok: true, data: row });
    });

    it("존재하지 않으면 { ok: true, data: null }을 반환한다", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findSecurityById("missing");

      expect(result).toEqual({ ok: true, data: null });
    });
  });

  describe("findLatestQuoteDate / findLatestDisclosureDate", () => {
    it("findLatestQuoteDate는 daily_quotes에서 trade_date DESC 1건을 조회한다", async () => {
      const { builder, calls } = createQueryBuilderMock({
        data: { trade_date: "2026-07-01" },
        error: null,
      });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findLatestQuoteDate("sec-1");

      expect(client.from).toHaveBeenCalledWith("daily_quotes");
      expect(calls).toContainEqual({ method: "order", args: ["trade_date", { ascending: false }] });
      expect(calls).toContainEqual({ method: "limit", args: [1] });
      expect(result).toEqual({ ok: true, data: "2026-07-01" });
    });

    it("findLatestQuoteDate 결과 없으면 null", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findLatestQuoteDate("sec-1");

      expect(result).toEqual({ ok: true, data: null });
    });

    it("findLatestDisclosureDate는 disclosures에서 disclosure_date DESC 1건을 조회한다", async () => {
      const { builder, calls } = createQueryBuilderMock({
        data: { disclosure_date: "2026-06-01" },
        error: null,
      });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findLatestDisclosureDate("sec-1");

      expect(client.from).toHaveBeenCalledWith("disclosures");
      expect(calls).toContainEqual({ method: "order", args: ["disclosure_date", { ascending: false }] });
      expect(result).toEqual({ ok: true, data: "2026-06-01" });
    });
  });

  describe("findQuarterlyFinancials", () => {
    it("fiscal_year 범위 필터 + 정렬을 적용한다", async () => {
      const { builder, calls } = createQueryBuilderMock({ data: [], error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      await repo.findQuarterlyFinancials("sec-1", 2020, 2024);

      expect(client.from).toHaveBeenCalledWith("quarterly_financials");
      expect(calls).toContainEqual({ method: "gte", args: ["fiscal_year", 2020] });
      expect(calls).toContainEqual({ method: "lte", args: ["fiscal_year", 2024] });
    });
  });

  describe("findDisclosures", () => {
    it("limit/offset을 range(offset, offset+limit-1)로 변환한다", async () => {
      const { builder, calls } = createQueryBuilderMock({ data: [], error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      await repo.findDisclosures("sec-1", 21, 20);

      expect(calls).toContainEqual({ method: "range", args: [20, 40] });
    });

    it("disclosure_date DESC + id DESC 2차 정렬을 적용한다", async () => {
      const { builder, calls } = createQueryBuilderMock({ data: [], error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      await repo.findDisclosures("sec-1", 20, 0);

      expect(calls).toContainEqual({ method: "order", args: ["disclosure_date", { ascending: false }] });
      expect(calls).toContainEqual({ method: "order", args: ["id", { ascending: false }] });
    });
  });

  describe("findDailyQuotes", () => {
    it("trade_date 오름차순 정렬 + 범위 필터를 적용한다", async () => {
      const { builder, calls } = createQueryBuilderMock({ data: [], error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      await repo.findDailyQuotes("sec-1", "2025-01-01", "2026-01-01");

      expect(calls).toContainEqual({ method: "gte", args: ["trade_date", "2025-01-01"] });
      expect(calls).toContainEqual({ method: "lte", args: ["trade_date", "2026-01-01"] });
      expect(calls).toContainEqual({ method: "order", args: ["trade_date", { ascending: true }] });
    });
  });

  describe("findRecentShares", () => {
    it("as_of_date DESC + limit을 적용한다", async () => {
      const { builder, calls } = createQueryBuilderMock({ data: [], error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createCompaniesRepository(client as never);

      await repo.findRecentShares("sec-1", 5);

      expect(calls).toContainEqual({ method: "order", args: ["as_of_date", { ascending: false }] });
      expect(calls).toContainEqual({ method: "limit", args: [5] });
    });
  });

  describe("findBelongingChains", () => {
    it("ownerId가 null이면 RPC에 p_owner_id: null을 전달한다", async () => {
      const client = { rpc: vi.fn(async () => ({ data: [], error: null })) };
      const repo = createCompaniesRepository(client as never);

      await repo.findBelongingChains("sec-1", null);

      expect(client.rpc).toHaveBeenCalledWith("fn_security_belonging_chains", {
        p_security_id: "sec-1",
        p_owner_id: null,
      });
    });

    it("ownerId가 있으면 그대로 전달한다", async () => {
      const client = { rpc: vi.fn(async () => ({ data: [], error: null })) };
      const repo = createCompaniesRepository(client as never);

      await repo.findBelongingChains("sec-1", "user-1");

      expect(client.rpc).toHaveBeenCalledWith("fn_security_belonging_chains", {
        p_security_id: "sec-1",
        p_owner_id: "user-1",
      });
    });

    it("RPC 오류 시 { ok: false, message }를 반환한다", async () => {
      const client = { rpc: vi.fn(async () => ({ data: null, error: { message: "boom" } })) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findBelongingChains("sec-1", null);

      expect(result).toEqual({ ok: false, message: "boom" });
    });

    it("data가 null이면 빈 배열로 정규화한다", async () => {
      const client = { rpc: vi.fn(async () => ({ data: null, error: null })) };
      const repo = createCompaniesRepository(client as never);

      const result = await repo.findBelongingChains("sec-1", null);

      expect(result).toEqual({ ok: true, data: [] });
    });
  });
});
