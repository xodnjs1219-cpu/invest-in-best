import { describe, expect, it, vi } from "vitest";
import { createSecuritiesSearchRepository } from "@/features/securities/backend/repository";

type RpcResult = { data: unknown[] | null; error: { message: string } | null };

const createSupabaseRpcMock = (result: RpcResult) => ({
  rpc: vi.fn(async () => result),
});

describe("createSecuritiesSearchRepository.searchByText", () => {
  it("market=null이면 rpc에 p_market: null을 전달한다", async () => {
    // Arrange
    const client = createSupabaseRpcMock({ data: [], error: null });
    const repository = createSecuritiesSearchRepository(client as never);

    // Act
    await repository.searchByText({ query: "삼성", market: null, limit: 21, offset: 0 });

    // Assert
    expect(client.rpc).toHaveBeenCalledWith("search_securities", {
      p_query: "삼성",
      p_limit: 21,
      p_offset: 0,
      p_market: null,
    });
  });

  it("market='KRX'면 rpc에 p_market: 'KRX'를 전달한다", async () => {
    // Arrange
    const client = createSupabaseRpcMock({ data: [], error: null });
    const repository = createSecuritiesSearchRepository(client as never);

    // Act
    await repository.searchByText({ query: "삼성", market: "KRX", limit: 21, offset: 0 });

    // Assert
    expect(client.rpc).toHaveBeenCalledWith(
      "search_securities",
      expect.objectContaining({ p_market: "KRX" }),
    );
  });

  it("limit/offset이 p_limit/p_offset으로 그대로 전달된다", async () => {
    // Arrange
    const client = createSupabaseRpcMock({ data: [], error: null });
    const repository = createSecuritiesSearchRepository(client as never);

    // Act
    await repository.searchByText({ query: "q", market: null, limit: 21, offset: 40 });

    // Assert
    expect(client.rpc).toHaveBeenCalledWith(
      "search_securities",
      expect.objectContaining({ p_limit: 21, p_offset: 40 }),
    );
  });

  it("rpc 성공 시 { ok: true, rows: data }를 반환한다", async () => {
    // Arrange
    const rows = [{ id: "1", ticker: "005930" }];
    const client = createSupabaseRpcMock({ data: rows, error: null });
    const repository = createSecuritiesSearchRepository(client as never);

    // Act
    const result = await repository.searchByText({
      query: "삼성",
      market: null,
      limit: 21,
      offset: 0,
    });

    // Assert
    expect(result).toEqual({ ok: true, rows });
  });

  it("rpc 실패 시 예외를 던지지 않고 { ok: false, message } 를 반환한다", async () => {
    // Arrange
    const client = createSupabaseRpcMock({ data: null, error: { message: "db down" } });
    const repository = createSecuritiesSearchRepository(client as never);

    // Act
    const result = await repository.searchByText({
      query: "삼성",
      market: null,
      limit: 21,
      offset: 0,
    });

    // Assert
    expect(result).toEqual({ ok: false, message: "db down" });
  });

  it("data가 null이고 error도 없으면 빈 배열로 정규화한다", async () => {
    // Arrange
    const client = createSupabaseRpcMock({ data: null, error: null });
    const repository = createSecuritiesSearchRepository(client as never);

    // Act
    const result = await repository.searchByText({
      query: "삼성",
      market: null,
      limit: 21,
      offset: 0,
    });

    // Assert
    expect(result).toEqual({ ok: true, rows: [] });
  });
});
