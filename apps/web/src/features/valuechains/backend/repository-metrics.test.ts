import { describe, expect, it, vi } from "vitest";
import {
  createChainMetricsRepository,
  findNodeDetailRow,
  findSnapshotMarkers,
  findSnapshotStructureAt,
  findDailyMetricAt,
  findQuarterlyMetric,
} from "@/features/valuechains/backend/repository";

/** gte/lte까지 지원하는 체인형 Supabase 쿼리 빌더 모킹 헬퍼(UC-010~012 전용 확장). */
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
  builder.in = record("in");
  builder.order = record("order");
  builder.limit = record("limit");
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: unknown) => void) => resolve(result);
  return { builder, calls };
};

describe("createChainMetricsRepository", () => {
  describe("findDailySeries", () => {
    it("chain_id + metric_date 범위 필터 + 오름차순 정렬로 조회한다", async () => {
      const rows = [{ metric_date: "2026-01-01", total_market_cap_krw: "100" }];
      const { builder, calls } = createQueryBuilderMock({ data: rows, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createChainMetricsRepository(client as never);

      const result = await repo.findDailySeries("chain-1", "2026-01-01", "2026-01-31");

      expect(client.from).toHaveBeenCalledWith("chain_daily_metrics");
      expect(calls).toContainEqual({ method: "eq", args: ["chain_id", "chain-1"] });
      expect(calls).toContainEqual({ method: "gte", args: ["metric_date", "2026-01-01"] });
      expect(calls).toContainEqual({ method: "lte", args: ["metric_date", "2026-01-31"] });
      expect(result).toEqual({ ok: true, data: rows });
    });

    it("Supabase 오류 시 ok:false를 반환한다(예외 미발생)", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: { message: "db down" } });
      const client = { from: vi.fn(() => builder) };
      const repo = createChainMetricsRepository(client as never);

      const result = await repo.findDailySeries("chain-1", "2026-01-01", "2026-01-31");

      expect(result).toEqual({ ok: false, message: "db down" });
    });
  });

  describe("findDailyByDate", () => {
    it("0행이면 ok:true, data:null을 반환한다(에러 아님 — E12)", async () => {
      const { builder } = createQueryBuilderMock({ data: null, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createChainMetricsRepository(client as never);

      const result = await repo.findDailyByDate("chain-1", "2026-01-01");

      expect(result).toEqual({ ok: true, data: null });
    });
  });

  describe("fetchDailyAnnotations", () => {
    it("rpc 함수명·파라미터 매핑을 검증한다", async () => {
      const rpcMock = vi.fn(async () => ({
        data: [{ shares_as_of_min: "2026-01-01", shares_as_of_max: "2026-02-01", all_closing_confirmed: true }],
        error: null,
      }));
      const client = { rpc: rpcMock };
      const repo = createChainMetricsRepository(client as never);

      const result = await repo.fetchDailyAnnotations("chain-1", "2026-01-01T14:59:59.000Z", "2026-01-01");

      expect(rpcMock).toHaveBeenCalledWith("fn_chain_daily_annotations", {
        p_chain_id: "chain-1",
        p_as_of: "2026-01-01T14:59:59.000Z",
        p_metric_date: "2026-01-01",
      });
      expect(result).toEqual({
        ok: true,
        data: { shares_as_of_min: "2026-01-01", shares_as_of_max: "2026-02-01", all_closing_confirmed: true },
      });
    });

    it("Supabase 오류 시 ok:false를 반환한다", async () => {
      const client = { rpc: vi.fn(async () => ({ data: null, error: { message: "rpc failed" } })) };
      const repo = createChainMetricsRepository(client as never);

      const result = await repo.fetchDailyAnnotations("chain-1", "2026-01-01T00:00:00Z", null);

      expect(result).toEqual({ ok: false, message: "rpc failed" });
    });
  });

  describe("findQuarterlySeries / findLatestQuarterly / findQuarterlyByQuarter", () => {
    it("findQuarterlySeries는 calendar_year 범위 + 2단계 정렬을 사용한다", async () => {
      const rows = [{ calendar_year: 2026, calendar_quarter: 1 }];
      const { builder, calls } = createQueryBuilderMock({ data: rows, error: null });
      const client = { from: vi.fn(() => builder) };
      const repo = createChainMetricsRepository(client as never);

      const result = await repo.findQuarterlySeries("chain-1", 2025, 2026);

      expect(client.from).toHaveBeenCalledWith("chain_quarterly_metrics");
      expect(calls).toContainEqual({ method: "gte", args: ["calendar_year", 2025] });
      expect(calls).toContainEqual({ method: "lte", args: ["calendar_year", 2026] });
      expect(result).toEqual({ ok: true, data: rows });
    });
  });
});

describe("findNodeDetailRow", () => {
  const createBuilder = (result: { data: unknown; error: unknown }) => {
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
    builder.maybeSingle = vi.fn(async () => result);
    return { builder, calls };
  };

  it("chain_snapshots.chain_id 필터로 체인 소속을 함께 검증한다", async () => {
    const row = { id: "node-1", node_kind: "free_subject" };
    const { builder, calls } = createBuilder({ data: row, error: null });
    const client = { from: vi.fn(() => builder) };

    const result = await findNodeDetailRow(client as never, "chain-1", "node-1");

    expect(client.from).toHaveBeenCalledWith("snapshot_nodes");
    expect(calls).toContainEqual({ method: "eq", args: ["id", "node-1"] });
    expect(calls).toContainEqual({ method: "eq", args: ["chain_snapshots.chain_id", "chain-1"] });
    expect(result).toEqual({ row });
  });

  it("0행이면 row:null을 반환한다(E7 — 타 체인 노드)", async () => {
    const { builder } = createBuilder({ data: null, error: null });
    const client = { from: vi.fn(() => builder) };

    const result = await findNodeDetailRow(client as never, "chain-1", "node-missing");

    expect(result).toEqual({ row: null });
  });

  it("Supabase 오류 시 dbError를 반환한다", async () => {
    const { builder } = createBuilder({ data: null, error: { message: "boom" } });
    const client = { from: vi.fn(() => builder) };

    const result = await findNodeDetailRow(client as never, "chain-1", "node-1");

    expect(result).toEqual({ dbError: "boom" });
  });
});

describe("findSnapshotMarkers", () => {
  it("effective_at 오름차순으로 전체 조회한다", async () => {
    const rows = [{ id: "s1", effective_at: "2026-01-01T00:00:00Z", change_source: "admin_edit" }];
    const { builder, calls } = createQueryBuilderMock({ data: rows, error: null });
    const client = { from: vi.fn(() => builder) };

    const result = await findSnapshotMarkers(client as never, "chain-1");

    expect(client.from).toHaveBeenCalledWith("chain_snapshots");
    expect(calls).toContainEqual({ method: "order", args: ["effective_at", { ascending: true }] });
    expect(result).toEqual({ ok: true, data: rows });
  });
});

describe("findSnapshotStructureAt", () => {
  it("fn_chain_snapshot_at RPC를 올바른 파라미터로 호출한다", async () => {
    const rpcMock = vi.fn(async () => ({ data: { snapshot: { id: "s1" } }, error: null }));
    const client = { rpc: rpcMock };

    const result = await findSnapshotStructureAt(client as never, "chain-1", "2026-05-02T14:59:59.000Z");

    expect(rpcMock).toHaveBeenCalledWith("fn_chain_snapshot_at", {
      p_chain_id: "chain-1",
      p_as_of: "2026-05-02T14:59:59.000Z",
    });
    expect(result).toEqual({ ok: true, data: { snapshot: { id: "s1" } } });
  });

  it("NULL 반환(스냅샷 없음) → data: null", async () => {
    const client = { rpc: vi.fn(async () => ({ data: null, error: null })) };

    const result = await findSnapshotStructureAt(client as never, "chain-1", "2014-01-01T00:00:00Z");

    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("findDailyMetricAt / findQuarterlyMetric", () => {
  it("findDailyMetricAt은 lte + DESC + limit(1)로 이월 규칙을 구현한다", async () => {
    const row = { metric_date: "2026-04-30", total_market_cap_krw: "100", is_carried_forward: true };
    const { builder, calls } = createQueryBuilderMock({ data: row, error: null });
    const client = { from: vi.fn(() => builder) };

    const result = await findDailyMetricAt(client as never, "chain-1", "2026-05-02");

    expect(client.from).toHaveBeenCalledWith("chain_daily_metrics");
    expect(calls).toContainEqual({ method: "lte", args: ["metric_date", "2026-05-02"] });
    expect(calls).toContainEqual({ method: "order", args: ["metric_date", { ascending: false }] });
    expect(calls).toContainEqual({ method: "limit", args: [1] });
    expect(result).toEqual({ ok: true, data: row });
  });

  it("findQuarterlyMetric은 (chain_id, year, quarter) eq 매칭으로 단건 조회한다", async () => {
    const row = { calendar_year: 2026, calendar_quarter: 2 };
    const { builder, calls } = createQueryBuilderMock({ data: row, error: null });
    const client = { from: vi.fn(() => builder) };

    const result = await findQuarterlyMetric(client as never, "chain-1", 2026, 2);

    expect(calls).toContainEqual({ method: "eq", args: ["calendar_year", 2026] });
    expect(calls).toContainEqual({ method: "eq", args: ["calendar_quarter", 2] });
    expect(result).toEqual({ ok: true, data: row });
  });
});
