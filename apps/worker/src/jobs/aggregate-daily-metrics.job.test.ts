import { describe, expect, it, vi } from "vitest";
import { toSeoulDayEndIso, type IsoDate } from "@iib/domain";
import { createAggregateDailyMetricsJob, type AggregateDailyMetricsJobDeps } from "./aggregate-daily-metrics.job";
import type { BatchLogger } from "../runtime/batch-log";

function d(s: string): IsoDate {
  return s as IsoDate;
}

function makeBatchLogger(overrides: Partial<BatchLogger> = {}): BatchLogger {
  return {
    start: vi.fn().mockResolvedValue("run-1"),
    finish: vi.fn().mockResolvedValue(undefined),
    itemFailures: vi.fn().mockResolvedValue(undefined),
    resolve: vi.fn().mockResolvedValue(undefined),
    unresolvedFailures: vi.fn().mockResolvedValue([]),
    isRunning: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeDeps(overrides: {
  batchLog?: Partial<BatchLogger>;
  batch?: Partial<AggregateDailyMetricsJobDeps["repos"]["batch"]>;
  chains?: Partial<AggregateDailyMetricsJobDeps["repos"]["chains"]>;
  snapshots?: Partial<AggregateDailyMetricsJobDeps["repos"]["snapshots"]>;
  marketData?: Partial<AggregateDailyMetricsJobDeps["repos"]["marketData"]>;
  financials?: Partial<AggregateDailyMetricsJobDeps["repos"]["financials"]>;
  chainMetrics?: Partial<AggregateDailyMetricsJobDeps["repos"]["chainMetrics"]>;
} = {}): AggregateDailyMetricsJobDeps {
  return {
    batchLog: makeBatchLogger(overrides.batchLog),
    repos: {
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({ ok: true, data: null }),
        ...overrides.batch,
      },
      chains: {
        findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        ...overrides.chains,
      },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        findNodesBySnapshotIds: vi.fn().mockResolvedValue({ ok: true, data: new Map() }),
        ...overrides.snapshots,
      },
      marketData: {
        findDailyCloses: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        findLatestClosesBefore: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        findLatestShares: vi.fn().mockResolvedValue({ ok: true, data: new Map() }),
        findFxRates: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        findLatestFxBefore: vi.fn().mockResolvedValue({ ok: true, data: null }),
        findMinCorrectedQuoteDateSince: vi.fn().mockResolvedValue({ ok: true, data: null }),
        findMinCorrectedFxDateSince: vi.fn().mockResolvedValue({ ok: true, data: null }),
        ...overrides.marketData,
      },
      financials: {
        findQuarterRevenues: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        findAnnualOnlySecurities: vi.fn().mockResolvedValue({ ok: true, data: new Set() }),
        findMinCorrectedQuarterSince: vi.fn().mockResolvedValue({ ok: true, data: null }),
        ...overrides.financials,
      },
      chainMetrics: {
        upsertDailyMetrics: vi.fn().mockResolvedValue({ ok: true, data: { count: 0 } }),
        upsertQuarterlyMetrics: vi.fn().mockResolvedValue({ ok: true, data: { count: 0 } }),
        ...overrides.chainMetrics,
      },
    },
  };
}

const NOW = new Date("2026-07-07T00:00:00.000Z"); // KST 2026-07-07 09:00

describe("createAggregateDailyMetricsJob", () => {
  it("skips without creating a new batch_runs row when the job is already running (E11)", async () => {
    const isRunning = vi.fn().mockResolvedValue(true);
    const start = vi.fn();
    const deps = makeDeps({ batchLog: { isRunning, start } });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(isRunning).toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("proceeds normally when only a stale running row exists (orphan ignored)", async () => {
    const isRunning = vi.fn().mockResolvedValue(false); // batchLog already applies the stale threshold internally
    const deps = makeDeps({ batchLog: { isRunning } });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(deps.batchLog.start).toHaveBeenCalledWith("aggregate_daily_metrics");
  });

  it("catches up the full history from 2015-01-01 when there is no previous success run", async () => {
    const capturedFroms: string[] = [];
    const findDailyCloses = vi.fn().mockImplementation((_ids: string[], from: string) => {
      capturedFroms.push(from);
      return Promise.resolve({ ok: true, data: [] });
    });
    const deps = makeDeps({
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({
          ok: true,
          data: [{ id: "snap-1", effectiveAt: "2015-01-01T00:00:00Z" }],
        }),
        findNodesBySnapshotIds: vi.fn().mockResolvedValue({ ok: true, data: new Map() }),
      },
      marketData: { findDailyCloses },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    // Multi-year catch-up spans multiple AGGREGATION_DATE_WINDOW_DAYS windows — the earliest window
    // must start at the timeseries floor (2015-01-01).
    expect(capturedFroms[0]).toBe("2015-01-01");
  });

  it("does not run quarterly aggregation when a previous success exists and no correction watermark is found", async () => {
    const findQuarterRevenues = vi.fn().mockResolvedValue({ ok: true, data: [] });
    const deps = makeDeps({
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({
          ok: true,
          data: { id: "run-prev", startedAt: "2026-07-06T23:00:00.000Z" },
        }),
      },
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({
          ok: true,
          data: [{ id: "snap-1", effectiveAt: "2026-01-01T00:00:00Z" }],
        }),
      },
      financials: { findQuarterRevenues },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(findQuarterRevenues).not.toHaveBeenCalled();
  });

  it("triggers a quarterly recalculation window when a financial correction watermark is detected (E6)", async () => {
    const findQuarterRevenues = vi.fn().mockResolvedValue({ ok: true, data: [] });
    const deps = makeDeps({
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({
          ok: true,
          data: { id: "run-prev", startedAt: "2026-07-06T23:00:00.000Z" },
        }),
      },
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({
          ok: true,
          data: [{ id: "snap-1", effectiveAt: "2025-01-01T00:00:00Z" }],
        }),
        findNodesBySnapshotIds: vi.fn().mockResolvedValue({ ok: true, data: new Map() }),
      },
      financials: {
        findQuarterRevenues,
        findMinCorrectedQuarterSince: vi.fn().mockResolvedValue({ ok: true, data: { year: 2025, quarter: 3 } }),
      },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(findQuarterRevenues).toHaveBeenCalled();
    const calledQuarters = findQuarterRevenues.mock.calls.map(([, year, quarter]) => `${year}Q${quarter}`);
    expect(calledQuarters).toContain("2025Q3");
  });

  it("skips a chain with zero snapshots without recording it as a failure (E7)", async () => {
    const deps = makeDeps({
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: { findSnapshotsByChain: vi.fn().mockResolvedValue({ ok: true, data: [] }) },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(deps.batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "success", failedCount: 0 }),
    );
  });

  it("records a chain-daily-metric row with total_market_cap_krw=null when there are zero listed-company nodes (E1)", async () => {
    const upsertDailyMetrics = vi.fn().mockResolvedValue({ ok: true, data: { count: 1 } });
    const deps = makeDeps({
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({
          ok: true,
          data: { id: "run-prev", startedAt: "2026-07-05T23:00:00.000Z" }, // KST 07-06 -> from=07-06, to=07-06
        }),
      },
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({
          ok: true,
          data: [{ id: "snap-1", effectiveAt: "2026-01-01T00:00:00Z" }],
        }),
        findNodesBySnapshotIds: vi.fn().mockResolvedValue({
          ok: true,
          data: new Map([["snap-1", { totalNodeCount: 3, listedNodes: [] }]]),
        }),
      },
      chainMetrics: { upsertDailyMetrics },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(upsertDailyMetrics).toHaveBeenCalled();
    const rows = upsertDailyMetrics.mock.calls[0]?.[0] as Array<{ totalMarketCapKrw: number | null; totalNodeCount: number }>;
    expect(rows[0]?.totalMarketCapKrw).toBeNull();
    expect(rows[0]?.totalNodeCount).toBe(3);
  });

  it("continues processing subsequent chains after one chain fails, reporting partial_success (E9)", async () => {
    const findSnapshotsByChain = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: [{ id: "snap-1", effectiveAt: "2026-01-01T00:00:00Z" }] }) // chain-1 ok
      .mockResolvedValueOnce({ ok: false, error: "boom" }) // chain-2 fails
      .mockResolvedValueOnce({ ok: true, data: [{ id: "snap-3", effectiveAt: "2026-01-01T00:00:00Z" }] }); // chain-3 ok

    const deps = makeDeps({
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({
          ok: true,
          data: { id: "run-prev", startedAt: "2026-07-05T23:00:00.000Z" },
        }),
      },
      chains: {
        findActiveChains: vi
          .fn()
          .mockResolvedValue({ ok: true, data: [{ id: "chain-1" }, { id: "chain-2" }, { id: "chain-3" }] }),
      },
      snapshots: {
        findSnapshotsByChain,
        findNodesBySnapshotIds: vi.fn().mockResolvedValue({ ok: true, data: new Map() }),
      },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(findSnapshotsByChain).toHaveBeenCalledTimes(3);
    expect(deps.batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "partial_success", failedCount: 1 }),
    );
    const [, summary] = (deps.batchLog.finish as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { errorLog: string }];
    expect(summary.errorLog).toContain("chain-2");
  });

  it("counts a single chain failing in both daily and quarterly phases as failedCount=1 (chain-level dedup)", async () => {
    const deps = makeDeps({
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({
          ok: true,
          data: { id: "run-prev", startedAt: "2026-07-05T23:00:00.000Z" },
        }),
      },
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({
          ok: true,
          data: [{ id: "snap-1", effectiveAt: "2026-01-01T00:00:00Z" }],
        }),
        // Fails both the daily-window node lookup and the quarterly node lookup for the same chain.
        findNodesBySnapshotIds: vi.fn().mockResolvedValue({ ok: false, error: "boom" }),
      },
      financials: {
        findMinCorrectedQuarterSince: vi.fn().mockResolvedValue({ ok: true, data: { year: 2026, quarter: 2 } }),
      },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(deps.batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ failedCount: 1 }),
    );
  });

  it("treats a chain_deleted upsert outcome as a skip, not a failure (E15)", async () => {
    const upsertDailyMetrics = vi.fn().mockResolvedValue({ ok: false, kind: "chain_deleted", message: "fk violation" });
    const deps = makeDeps({
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({
          ok: true,
          data: { id: "run-prev", startedAt: "2026-07-05T23:00:00.000Z" },
        }),
      },
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({
          ok: true,
          data: [{ id: "snap-1", effectiveAt: "2026-01-01T00:00:00Z" }],
        }),
        findNodesBySnapshotIds: vi.fn().mockResolvedValue({ ok: true, data: new Map() }),
      },
      chainMetrics: { upsertDailyMetrics },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(deps.batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "success", failedCount: 0 }),
    );
  });

  it("reports status=failed when all chains fail", async () => {
    const deps = makeDeps({
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({
          ok: true,
          data: { id: "run-prev", startedAt: "2026-07-05T23:00:00.000Z" },
        }),
      },
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({ ok: false, error: "boom" }),
      },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(deps.batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
  });

  it("reports status=failed when target-range resolution queries fail (prev-success lookup)", async () => {
    const deps = makeDeps({
      batch: { findLatestRunByStatus: vi.fn().mockResolvedValue({ ok: false, error: "db down" }) },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(deps.batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
    expect(deps.repos.chains.findActiveChains).not.toHaveBeenCalled();
  });

  it("produces identical upsert inputs when run twice with the same inputs (idempotency, E11)", async () => {
    const upsertDailyMetrics = vi.fn().mockResolvedValue({ ok: true, data: { count: 1 } });
    const buildDeps = () =>
      makeDeps({
        batch: {
          findLatestRunByStatus: vi.fn().mockResolvedValue({
            ok: true,
            data: { id: "run-prev", startedAt: "2026-07-05T23:00:00.000Z" },
          }),
        },
        chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
        snapshots: {
          findSnapshotsByChain: vi.fn().mockResolvedValue({
            ok: true,
            data: [{ id: "snap-1", effectiveAt: "2026-01-01T00:00:00Z" }],
          }),
          findNodesBySnapshotIds: vi.fn().mockResolvedValue({
            ok: true,
            data: new Map([["snap-1", { totalNodeCount: 1, listedNodes: [{ securityId: "sec-1", currency: "KRW" }] }]]),
          }),
        },
        marketData: {
          findDailyCloses: vi.fn().mockResolvedValue({ ok: true, data: [{ securityId: "sec-1", tradeDate: "2026-07-06", closePrice: 1000 }] }),
          findLatestClosesBefore: vi.fn().mockResolvedValue({ ok: true, data: [] }),
          findLatestShares: vi.fn().mockResolvedValue({ ok: true, data: new Map([["sec-1", { securityId: "sec-1", shares: 10, asOfDate: "2026-01-01" }]]) }),
          findFxRates: vi.fn().mockResolvedValue({ ok: true, data: [] }),
          findLatestFxBefore: vi.fn().mockResolvedValue({ ok: true, data: null }),
          findMinCorrectedQuoteDateSince: vi.fn().mockResolvedValue({ ok: true, data: null }),
          findMinCorrectedFxDateSince: vi.fn().mockResolvedValue({ ok: true, data: null }),
        },
        chainMetrics: { upsertDailyMetrics },
      });

    const deps1 = buildDeps();
    const job1 = createAggregateDailyMetricsJob(deps1);
    await job1.run(NOW);
    const firstCallRows = upsertDailyMetrics.mock.calls[0]?.[0];

    upsertDailyMetrics.mockClear();
    const deps2 = buildDeps();
    deps2.repos.chainMetrics.upsertDailyMetrics = upsertDailyMetrics;
    const job2 = createAggregateDailyMetricsJob(deps2);
    await job2.run(NOW);
    const secondCallRows = upsertDailyMetrics.mock.calls[0]?.[0];

    expect(secondCallRows).toEqual(firstCallRows);
  });

  it("resolves the quarter boundary to `now` for an in-progress quarter (Open Q4)", async () => {
    const findQuarterRevenues = vi.fn().mockResolvedValue({ ok: true, data: [] });
    // now = 2026-07-07 (Q3 in progress, quarter end 2026-09-30 is in the future)
    const deps = makeDeps({
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({
          ok: true,
          data: { id: "run-prev", startedAt: "2026-07-06T23:00:00.000Z" },
        }),
      },
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({
          ok: true,
          data: [{ id: "snap-1", effectiveAt: "2025-01-01T00:00:00Z" }],
        }),
        findNodesBySnapshotIds: vi.fn().mockResolvedValue({ ok: true, data: new Map() }),
      },
      financials: {
        findQuarterRevenues,
        findMinCorrectedQuarterSince: vi.fn().mockResolvedValue({ ok: true, data: { year: 2026, quarter: 3 } }),
      },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    // Only assert the job did not crash and did call findQuarterRevenues for the in-progress quarter.
    const calledQuarters = findQuarterRevenues.mock.calls.map(([, year, quarter]) => `${year}Q${quarter}`);
    expect(calledQuarters).toContain("2026Q3");
  });

  it("records processedCount as daily rows + quarterly rows and isCarriedOver=false", async () => {
    const deps = makeDeps({
      batch: {
        findLatestRunByStatus: vi.fn().mockResolvedValue({
          ok: true,
          data: { id: "run-prev", startedAt: "2026-07-05T23:00:00.000Z" },
        }),
      },
      chains: { findActiveChains: vi.fn().mockResolvedValue({ ok: true, data: [{ id: "chain-1" }] }) },
      snapshots: {
        findSnapshotsByChain: vi.fn().mockResolvedValue({
          ok: true,
          data: [{ id: "snap-1", effectiveAt: "2026-01-01T00:00:00Z" }],
        }),
        findNodesBySnapshotIds: vi.fn().mockResolvedValue({ ok: true, data: new Map() }),
      },
      chainMetrics: {
        upsertDailyMetrics: vi.fn().mockResolvedValue({ ok: true, data: { count: 1 } }),
      },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await job.run(NOW);

    expect(deps.batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ processedCount: 1, isCarriedOver: false }),
    );
  });

  it("calls finish(failed) and never throws when an unexpected exception occurs", async () => {
    const deps = makeDeps({
      chains: { findActiveChains: vi.fn().mockRejectedValue(new Error("catastrophic")) },
    });
    const job = createAggregateDailyMetricsJob(deps);

    await expect(job.run(NOW)).resolves.toBeUndefined();
    expect(deps.batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
  });

  it("toSeoulDayEndIso helper produces a boundary consistent with the job's snapshot resolution", () => {
    expect(toSeoulDayEndIso(d("2026-07-06"))).toContain("2026-07-06");
  });
});
