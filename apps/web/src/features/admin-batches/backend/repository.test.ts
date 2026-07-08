import { describe, expect, it, vi } from "vitest";
import {
  countBackfillCheckpoints,
  findLatestBackfillRun,
  findRunById,
  listFailuresByRun,
  listRunSummaries,
} from "@/features/admin-batches/backend/repository";

/**
 * Supabase 쿼리 빌더 체이너블 mock — 호출된 메서드명/인자를 calls 배열에 기록하고,
 * 최종적으로 `await`(then)되면 resolvedValue를 반환한다.
 */
function createQueryBuilderMock(resolvedValue: unknown) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  const chainableMethods = ["select", "eq", "gte", "lte", "order", "range", "limit"];

  for (const method of chainableMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }

  builder.maybeSingle = vi.fn(async () => resolvedValue);
  // range()/limit() 마지막 호출이 실제로는 thenable을 반환해야 하므로 builder 자체를 thenable로 만든다.
  (builder as unknown as { then: (resolve: (v: unknown) => void) => void }).then = (resolve: (v: unknown) => void) =>
    resolve(resolvedValue);

  return { builder, calls };
}

describe("listRunSummaries", () => {
  it("필터 미지정 시 eq를 걸지 않고 batch_runs_summary를 정렬·페이지네이션한다(R-2·R-3)", async () => {
    const rows = [{ id: "run-1" }];
    const { builder, calls } = createQueryBuilderMock({ data: rows, error: null, count: 1 });
    const fromMock = vi.fn(() => builder);
    const client = { from: fromMock };

    const result = await listRunSummaries(client as never, {
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual({ ok: true, rows, totalCount: 1 });
    expect(fromMock).toHaveBeenCalledWith("batch_runs_summary");
    expect(calls.find((c) => c.method === "eq")).toBeUndefined();
    expect(calls.some((c) => c.method === "order" && c.args[0] === "started_at")).toBe(true);
    expect(calls.some((c) => c.method === "range" && c.args[0] === 0 && c.args[1] === 19)).toBe(true);
  });

  it("jobType/status/from/to 지정 시 해당 조건만 추가한다", async () => {
    const { builder, calls } = createQueryBuilderMock({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => builder) };

    await listRunSummaries(client as never, {
      jobType: "collect_financials",
      status: "partial_success",
      fromIso: "2026-07-01T00:00:00+09:00",
      toIso: "2026-07-05T00:00:00+09:00",
      limit: 20,
      offset: 0,
    });

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "job_type" && c.args[1] === "collect_financials")).toBe(
      true,
    );
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "partial_success")).toBe(
      true,
    );
    expect(calls.some((c) => c.method === "gte" && c.args[0] === "started_at")).toBe(true);
    expect(calls.some((c) => c.method === "lte" && c.args[0] === "started_at")).toBe(true);
  });

  it("count:'exact' 옵션으로 select를 호출한다", async () => {
    const { builder, calls } = createQueryBuilderMock({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => builder) };

    await listRunSummaries(client as never, { limit: 20, offset: 0 });

    const selectCall = calls.find((c) => c.method === "select");
    expect(selectCall?.args[1]).toEqual(expect.objectContaining({ count: "exact" }));
  });

  it("DB 오류 응답 시 throw 없이 {ok:false}를 반환한다", async () => {
    const { builder } = createQueryBuilderMock({ data: null, error: { message: "db down" }, count: null });
    const client = { from: vi.fn(() => builder) };

    const result = await listRunSummaries(client as never, { limit: 20, offset: 0 });

    expect(result).toEqual({ ok: false, message: "db down" });
  });

  it("0건 결과도 정상 처리한다(E1)", async () => {
    const { builder } = createQueryBuilderMock({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => builder) };

    const result = await listRunSummaries(client as never, { limit: 20, offset: 0 });

    expect(result).toEqual({ ok: true, rows: [], totalCount: 0 });
  });
});

describe("findRunById", () => {
  it("error_log를 포함해 조회하고 존재하면 행을 반환한다", async () => {
    const row = { id: "run-1", error_log: "boom" };
    const { builder, calls } = createQueryBuilderMock({ data: row, error: null });
    const client = { from: vi.fn(() => builder) };

    const result = await findRunById(client as never, "run-1");

    expect(result).toEqual({ ok: true, row });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === "run-1")).toBe(true);
  });

  it("0행이면 throw 없이 null을 반환한다(E8 입력)", async () => {
    const { builder } = createQueryBuilderMock({ data: null, error: null });
    const client = { from: vi.fn(() => builder) };

    const result = await findRunById(client as never, "missing-run");

    expect(result).toEqual({ ok: true, row: null });
  });

  it("DB 오류 시 {ok:false}를 반환한다", async () => {
    const { builder } = createQueryBuilderMock({ data: null, error: { message: "fail" } });
    const client = { from: vi.fn(() => builder) };

    const result = await findRunById(client as never, "run-1");

    expect(result).toEqual({ ok: false, message: "fail" });
  });
});

describe("listFailuresByRun", () => {
  it("batch_run_id eq + updated_at DESC 정렬 + securities 임베드를 사용한다(R-9)", async () => {
    const rows = [{ id: "f-1" }];
    const { builder, calls } = createQueryBuilderMock({ data: rows, error: null, count: 1 });
    const client = { from: vi.fn(() => builder) };

    const result = await listFailuresByRun(client as never, "run-1", { limit: 20, offset: 0 });

    expect(result).toEqual({ ok: true, rows, totalCount: 1 });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "batch_run_id" && c.args[1] === "run-1")).toBe(true);
    expect(calls.some((c) => c.method === "order" && c.args[0] === "updated_at")).toBe(true);
  });

  it("DB 오류 시 {ok:false}를 반환한다", async () => {
    const { builder } = createQueryBuilderMock({ data: null, error: { message: "fail" }, count: null });
    const client = { from: vi.fn(() => builder) };

    const result = await listFailuresByRun(client as never, "run-1", { limit: 20, offset: 0 });

    expect(result).toEqual({ ok: false, message: "fail" });
  });
});

describe("countBackfillCheckpoints", () => {
  it("head:true count 쿼리 2회로 total/completed를 반환한다(R-5)", async () => {
    let call = 0;
    const responses = [
      { data: null, error: null, count: 3200 },
      { data: null, error: null, count: 2710 },
    ];
    const fromMock = vi.fn(() => {
      const { builder } = createQueryBuilderMock(responses[call]);
      call += 1;
      return builder;
    });
    const client = { from: fromMock };

    const result = await countBackfillCheckpoints(client as never);

    expect(result).toEqual({ ok: true, total: 3200, completed: 2710 });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("오류 시 {ok:false}를 반환한다", async () => {
    const { builder } = createQueryBuilderMock({ data: null, error: { message: "fail" }, count: null });
    const client = { from: vi.fn(() => builder) };

    const result = await countBackfillCheckpoints(client as never);

    expect(result).toEqual({ ok: false, message: "fail" });
  });
});

describe("findLatestBackfillRun", () => {
  it("job_type=backfill_all 최신 1건을 조회한다", async () => {
    const row = { id: "run-1", status: "partial_success" };
    const { builder, calls } = createQueryBuilderMock({ data: row, error: null });
    const client = { from: vi.fn(() => builder) };

    const result = await findLatestBackfillRun(client as never);

    expect(result).toEqual({ ok: true, row });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "job_type" && c.args[1] === "backfill_all")).toBe(
      true,
    );
    expect(calls.some((c) => c.method === "limit" && c.args[0] === 1)).toBe(true);
  });

  it("실행 이력이 없으면 null을 반환한다(E11)", async () => {
    const { builder } = createQueryBuilderMock({ data: null, error: null });
    const client = { from: vi.fn(() => builder) };

    const result = await findLatestBackfillRun(client as never);

    expect(result).toEqual({ ok: true, row: null });
  });
});
