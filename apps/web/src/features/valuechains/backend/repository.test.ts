import { describe, expect, it, vi } from "vitest";
import {
  createValuechainsViewRepository,
  findChainCards,
  RepositoryError,
} from "@/features/valuechains/backend/repository";

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
  builder.in = record("in");
  builder.order = record("order");
  builder.limit = record("limit");
  builder.maybeSingle = vi.fn(async () => result);
  // limit()/order() 체인의 최종 then (배열 결과) — thenable 지원
  builder.then = (resolve: (value: unknown) => void) => resolve(result);
  return { builder, calls };
};

describe("createValuechainsViewRepository", () => {
  describe("findChainById", () => {
    it("value_chains에 eq('id') 필터 + focus_security 조인 select로 호출하고 행을 반환한다", async () => {
      // Arrange
      const row = { id: "chain-1", chain_type: "official" };
      const { builder, calls } = createQueryBuilderMock({ data: row, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findChainById("chain-1");

      // Assert
      expect(client.from).toHaveBeenCalledWith("value_chains");
      expect(calls.some((c) => c.method === "select")).toBe(true);
      const selectCall = calls.find((c) => c.method === "select");
      expect(String(selectCall?.args[0])).toContain("focus_security");
      expect(calls).toContainEqual({ method: "eq", args: ["id", "chain-1"] });
      expect(result).toEqual(row);
    });

    it("행이 없으면 null을 반환한다", async () => {
      // Arrange
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findChainById("missing");

      // Assert
      expect(result).toBeNull();
    });

    it("Supabase 오류 시 RepositoryError를 throw한다", async () => {
      // Arrange
      const { builder } = createQueryBuilderMock({
        data: null,
        error: { message: "db down" },
      });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act & Assert
      await expect(repo.findChainById("chain-1")).rejects.toThrow(RepositoryError);
    });
  });

  describe("findLatestSnapshot", () => {
    it("effective_at DESC + limit(1)을 적용한다", async () => {
      // Arrange
      const row = { id: "snap-1", chain_id: "chain-1", effective_at: "2026-07-01T00:00:00Z" };
      const { builder, calls } = createQueryBuilderMock({ data: row, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findLatestSnapshot("chain-1");

      // Assert
      expect(client.from).toHaveBeenCalledWith("chain_snapshots");
      expect(calls).toContainEqual({
        method: "order",
        args: ["effective_at", { ascending: false }],
      });
      expect(calls).toContainEqual({ method: "limit", args: [1] });
      expect(result).toEqual(row);
    });

    it("스냅샷이 없으면 null을 반환한다 (E9)", async () => {
      // Arrange
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findLatestSnapshot("chain-1");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findSnapshotGroups / findSnapshotNodes / findSnapshotEdges", () => {
    it("findSnapshotGroups는 snapshot_id로 필터한다", async () => {
      // Arrange
      const rows = [{ id: "g1", name: "소재" }];
      const { builder, calls } = createQueryBuilderMock({ data: rows, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findSnapshotGroups("snap-1");

      // Assert
      expect(client.from).toHaveBeenCalledWith("snapshot_groups");
      expect(calls).toContainEqual({ method: "eq", args: ["snapshot_id", "snap-1"] });
      expect(result).toEqual(rows);
    });

    it("findSnapshotNodes는 securities 조인 select를 사용한다", async () => {
      // Arrange
      const rows = [{ id: "n1", node_kind: "listed_company" }];
      const { builder, calls } = createQueryBuilderMock({ data: rows, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findSnapshotNodes("snap-1");

      // Assert
      expect(client.from).toHaveBeenCalledWith("snapshot_nodes");
      const selectCall = calls.find((c) => c.method === "select");
      expect(String(selectCall?.args[0])).toContain("security");
      expect(result).toEqual(rows);
    });

    it("findSnapshotEdges는 relation_types 조인 select를 사용하고 is_active 필터가 없다 (E5)", async () => {
      // Arrange
      const rows = [{ id: "e1", relation_type: { is_active: false } }];
      const { builder, calls } = createQueryBuilderMock({ data: rows, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findSnapshotEdges("snap-1");

      // Assert
      expect(client.from).toHaveBeenCalledWith("snapshot_edges");
      const selectCall = calls.find((c) => c.method === "select");
      expect(String(selectCall?.args[0])).toContain("relation_type");
      expect(calls.some((c) => c.method === "eq" && c.args[0] === "is_active")).toBe(false);
      expect(result).toEqual(rows);
    });

    it("배열 조회 중 오류 시 RepositoryError를 throw한다", async () => {
      // Arrange
      const { builder } = createQueryBuilderMock({ data: null, error: { message: "boom" } });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act & Assert
      await expect(repo.findSnapshotNodes("snap-1")).rejects.toThrow(RepositoryError);
    });
  });

  describe("findLatestBatchSuccessAt", () => {
    it("status in [success, partial_success] 필터 + finished_at DESC로 최신 1건을 조회한다", async () => {
      // Arrange
      const row = { finished_at: "2026-07-05T15:10:00+09:00" };
      const { builder, calls } = createQueryBuilderMock({ data: row, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findLatestBatchSuccessAt("collect_quotes");

      // Assert
      expect(client.from).toHaveBeenCalledWith("batch_runs");
      expect(calls).toContainEqual({
        method: "in",
        args: ["status", ["success", "partial_success"]],
      });
      expect(result).toBe("2026-07-05T15:10:00+09:00");
    });

    it("이력이 없으면 null을 반환한다 (E13)", async () => {
      // Arrange
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findLatestBatchSuccessAt("collect_financials");

      // Assert
      expect(result).toBeNull();
    });

    it("행은 있지만 finished_at이 null이면 null을 반환한다", async () => {
      // Arrange
      const { builder } = createQueryBuilderMock({ data: { finished_at: null }, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createValuechainsViewRepository(client as never);

      // Act
      const result = await repo.findLatestBatchSuccessAt("collect_fx_market_hours");

      // Assert
      expect(result).toBeNull();
    });
  });
});

describe("findChainCards (UC-007 체인 카드 목록)", () => {
  it("official 조회 시 p_chain_type='official', p_owner_id=null로 RPC를 정확히 1회 호출한다", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: [], error: null })) };

    // Act
    await findChainCards(client as never, {
      chainType: "official",
      ownerId: null,
      limit: 20,
      offset: 0,
    });

    // Assert
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("list_chain_cards", {
      p_chain_type: "official",
      p_owner_id: null,
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("mine 조회 시 p_owner_id에 사용자 id를 전달한다", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: [], error: null })) };

    // Act
    await findChainCards(client as never, {
      chainType: "user",
      ownerId: "user-1",
      limit: 20,
      offset: 20,
    });

    // Assert
    expect(client.rpc).toHaveBeenCalledWith("list_chain_cards", {
      p_chain_type: "user",
      p_owner_id: "user-1",
      p_limit: 20,
      p_offset: 20,
    });
  });

  it("RPC 성공 시 { rows: data, error: null }을 반환한다", async () => {
    // Arrange
    const rows = [{ id: "chain-1" }];
    const client = { rpc: vi.fn(async () => ({ data: rows, error: null })) };

    // Act
    const result = await findChainCards(client as never, {
      chainType: "official",
      ownerId: null,
      limit: 20,
      offset: 0,
    });

    // Assert
    expect(result).toEqual({ rows, error: null });
  });

  it("RPC 오류 시 예외를 던지지 않고 { rows: [], error: message }를 반환한다", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: null, error: { message: "db down" } })) };

    // Act
    const result = await findChainCards(client as never, {
      chainType: "official",
      ownerId: null,
      limit: 20,
      offset: 0,
    });

    // Assert
    expect(result).toEqual({ rows: [], error: "db down" });
  });

  it("data가 null이고 error도 없으면 rows를 빈 배열로 정규화한다", async () => {
    // Arrange
    const client = { rpc: vi.fn(async () => ({ data: null, error: null })) };

    // Act
    const result = await findChainCards(client as never, {
      chainType: "official",
      ownerId: null,
      limit: 20,
      offset: 0,
    });

    // Assert
    expect(result).toEqual({ rows: [], error: null });
  });
});
