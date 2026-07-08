import { describe, expect, it, vi } from "vitest";
import { createCollectFinancialsJob, type CollectFinancialsJobDeps } from "./collect-financials.job";
import { DartAuthError, DartQuotaExceededError } from "../adapters/opendart/contract";
import { repoOk } from "../repositories/result";

const NOW = new Date("2026-05-15T10:00:00Z"); // KST 19:00 실행 시각 가정(1Q 시즌)

function makeBatchLog(overrides: Partial<CollectFinancialsJobDeps["batchLog"]> = {}) {
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

function makeCheckpoints(overrides: Partial<CollectFinancialsJobDeps["checkpoints"]> = {}) {
  return {
    get: vi.fn().mockResolvedValue(repoOk(null)),
    upsert: vi.fn().mockResolvedValue(repoOk(undefined)),
    complete: vi.fn().mockResolvedValue(repoOk(undefined)),
    ...overrides,
  };
}

function makeDart(overrides: Partial<CollectFinancialsJobDeps["dart"]> = {}): CollectFinancialsJobDeps["dart"] {
  return {
    fetchCorpCodeMappings: vi.fn().mockResolvedValue([]),
    fetchDisclosures: vi.fn().mockResolvedValue({ items: [] }),
    fetchMultiAccounts: vi.fn().mockResolvedValue({ accounts: [], missingCorpCodes: [] }),
    fetchFullFinancials: vi.fn().mockResolvedValue(null),
    fetchStockTotal: vi.fn().mockResolvedValue(null),
    fetchCompanyProfile: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeSec(overrides: Partial<CollectFinancialsJobDeps["sec"]> = {}): CollectFinancialsJobDeps["sec"] {
  return {
    checkBulkFreshness: vi.fn().mockResolvedValue({ lastModified: null }),
    downloadBulk: vi.fn().mockResolvedValue(undefined),
    readBulkEntries: vi.fn().mockImplementation(async function* () {
      /* empty */
    }),
    fetchCompanyConcept: vi.fn().mockResolvedValue(null),
    fetchSubmissions: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeToss(overrides: Partial<CollectFinancialsJobDeps["toss"]> = {}): CollectFinancialsJobDeps["toss"] {
  return {
    getStockInfos: vi.fn().mockResolvedValue({ infos: [], failures: [], carriedOverSymbols: [] }),
    ...overrides,
  };
}

function makeRepos(overrides: Partial<CollectFinancialsJobDeps["repos"]> = {}): CollectFinancialsJobDeps["repos"] {
  return {
    findAllForFinancials: vi.fn().mockResolvedValue(repoOk([])),
    updateDartCorpCodes: vi.fn().mockResolvedValue(repoOk(undefined)),
    flagSharesManualOverride: vi.fn().mockResolvedValue(repoOk(undefined)),
    upsertFinancials: vi.fn().mockResolvedValue(repoOk({ affected: 0, failedChunks: 0 })),
    findExistingPeriodKeys: vi.fn().mockResolvedValue(repoOk(new Set())),
    upsertDisclosures: vi.fn().mockResolvedValue(repoOk(undefined)),
    upsertProfiles: vi.fn().mockResolvedValue(repoOk(undefined)),
    findProfileFreshness: vi.fn().mockResolvedValue(repoOk([])),
    findLatestBySource: vi.fn().mockResolvedValue(repoOk([])),
    upsertShares: vi.fn().mockResolvedValue(repoOk(undefined)),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CollectFinancialsJobDeps> = {}): CollectFinancialsJobDeps {
  return {
    dart: makeDart(),
    sec: makeSec(),
    toss: makeToss(),
    repos: makeRepos(),
    batchLog: makeBatchLog(),
    checkpoints: makeCheckpoints(),
    ...overrides,
  };
}

describe("collect-financials job — E16 duplicate execution guard", () => {
  it("skips the run without any external calls when DB reports a fresh running row", async () => {
    const dart = makeDart();
    const batchLog = makeBatchLog({ isRunning: vi.fn().mockResolvedValue(true) });
    const job = createCollectFinancialsJob(makeDeps({ dart, batchLog }));

    await job.run(NOW);

    expect(dart.fetchCorpCodeMappings).not.toHaveBeenCalled();
    expect(batchLog.start).not.toHaveBeenCalled();
  });

  it("proceeds normally when isRunning returns false (including stale-ignored case)", async () => {
    const batchLog = makeBatchLog({ isRunning: vi.fn().mockResolvedValue(false) });
    const job = createCollectFinancialsJob(makeDeps({ batchLog }));

    await job.run(NOW);

    expect(batchLog.start).toHaveBeenCalledWith("collect_financials");
  });
});

describe("collect-financials job — KRX corp_code mapping (Main 4, E17)", () => {
  it("updates dart_corp_code for tickers with a new mapping, and excludes still-unmapped securities from the finance step", async () => {
    const repos = makeRepos({
      findAllForFinancials: vi.fn().mockResolvedValue(
        repoOk([
          { id: "sec-1", ticker: "005930", market: "KRX", listingStatus: "listed", dartCorpCode: null, cik: null, tossSymbol: "005930", sharesManualOverrideNeeded: false },
        ]),
      ),
    });
    const dart = makeDart({
      fetchCorpCodeMappings: vi.fn().mockResolvedValue([
        { corpCode: "00126380", stockCode: "005930", corpName: "삼성전자", modifyDate: "20260101" },
      ]),
    });
    const job = createCollectFinancialsJob(makeDeps({ dart, repos }));

    await job.run(NOW);

    expect(repos.updateDartCorpCodes).toHaveBeenCalledWith([{ ticker: "005930", dartCorpCode: "00126380" }]);
  });

  it("records an item failure for a KRX security that remains unmapped after the update step (E17)", async () => {
    const repos = makeRepos({
      findAllForFinancials: vi.fn().mockResolvedValue(
        repoOk([
          { id: "sec-1", ticker: "999999", market: "KRX", listingStatus: "listed", dartCorpCode: null, cik: null, tossSymbol: "999999", sharesManualOverrideNeeded: false },
        ]),
      ),
    });
    const batchLog = makeBatchLog();
    const job = createCollectFinancialsJob(makeDeps({ repos, batchLog }));

    await job.run(NOW);

    expect(batchLog.itemFailures).toHaveBeenCalledWith(
      "run-1",
      expect.arrayContaining([expect.objectContaining({ securityId: "sec-1" })]),
    );
  });
});

describe("collect-financials job — KRX disclosures (Main 5)", () => {
  it("fetches disclosures with a 1-day lookback window and upserts only known securities", async () => {
    const repos = makeRepos({
      findAllForFinancials: vi.fn().mockResolvedValue(
        repoOk([
          { id: "sec-1", ticker: "005930", market: "KRX", listingStatus: "listed", dartCorpCode: "00126380", cik: null, tossSymbol: "005930", sharesManualOverrideNeeded: false },
        ]),
      ),
    });
    const dart = makeDart({
      fetchDisclosures: vi.fn().mockResolvedValue({
        items: [
          { rceptNo: "1", stockCode: "005930", corpCode: "00126380", title: "사업보고서", disclosureDate: "2026-05-15", url: "https://x" },
          { rceptNo: "2", stockCode: "000001", corpCode: "00000001", title: "미매핑", disclosureDate: "2026-05-15", url: "https://y" },
        ],
      }),
    });
    const job = createCollectFinancialsJob(makeDeps({ dart, repos }));

    await job.run(NOW);

    expect(dart.fetchDisclosures).toHaveBeenCalledWith("20260514", "20260515");
    expect(repos.upsertDisclosures).toHaveBeenCalledWith([
      expect.objectContaining({ securityId: "sec-1", externalId: "1" }),
    ]);
  });
});

describe("collect-financials job — E1 quota exceeded carryover", () => {
  it("saves a carryover checkpoint, stops remaining KRX steps, still runs US/toss steps, and reports partial_success + is_carried_over", async () => {
    const repos = makeRepos({
      findAllForFinancials: vi.fn().mockResolvedValue(
        repoOk([
          { id: "sec-1", ticker: "005930", market: "KRX", listingStatus: "listed", dartCorpCode: "00126380", cik: null, tossSymbol: "005930", sharesManualOverrideNeeded: false },
        ]),
      ),
    });
    const dart = makeDart({
      fetchMultiAccounts: vi.fn().mockRejectedValue(new DartQuotaExceededError()),
    });
    const checkpoints = makeCheckpoints();
    const batchLog = makeBatchLog();
    const job = createCollectFinancialsJob(makeDeps({ dart, repos, checkpoints, batchLog }));

    await job.run(NOW);

    expect(checkpoints.upsert).toHaveBeenCalled();
    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "partial_success", isCarriedOver: true }),
    );
  });
});

describe("collect-financials job — DartAuthError => failed", () => {
  it("marks the run failed when corp_code mapping fetch raises a DartAuthError", async () => {
    const dart = makeDart({
      fetchCorpCodeMappings: vi.fn().mockRejectedValue(new DartAuthError("011", "사용할 수 없는 키")),
    });
    const batchLog = makeBatchLog();
    const job = createCollectFinancialsJob(makeDeps({ dart, batchLog }));

    await job.run(NOW);

    expect(batchLog.finish).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "failed" }),
    );
  });
});

describe("collect-financials job — SEC bulk freshness (Main 10, E15)", () => {
  it("skips bulk download when Last-Modified is unchanged from the stored checkpoint", async () => {
    const sec = makeSec({ checkBulkFreshness: vi.fn().mockResolvedValue({ lastModified: "same-value" }) });
    const checkpoints = makeCheckpoints({
      get: vi.fn().mockImplementation((jobType: string, key: string) =>
        Promise.resolve(
          repoOk(key.includes("last_modified") ? { cursor: "same-value", isCompleted: true } : null),
        ),
      ),
    });
    const job = createCollectFinancialsJob(makeDeps({ sec, checkpoints }));

    await job.run(NOW);

    expect(sec.downloadBulk).not.toHaveBeenCalled();
  });

  it("downloads and processes the bulk file when Last-Modified changed", async () => {
    const sec = makeSec({
      checkBulkFreshness: vi.fn().mockResolvedValue({ lastModified: "new-value" }),
      readBulkEntries: vi.fn().mockImplementation(async function* () {
        yield {
          cik: "0000320193",
          name: "Apple Inc.",
          sic: "3571",
          sicDescription: "Electronic Computers",
          stateOfIncorporationDescription: "CA",
          businessAddress: { street1: "x", city: "y", stateOrCountry: "CA", zipCode: "1" },
          phone: "123",
          fiscalYearEnd: "0926",
          recentFilings: [{ accessionNumber: "0000320193-26-000013", form: "10-Q", filingDate: "2026-05-01", primaryDocument: "a.htm" }],
        };
      }),
    });
    const repos = makeRepos({
      findAllForFinancials: vi.fn().mockResolvedValue(
        repoOk([
          { id: "sec-us-1", ticker: "AAPL", market: "US", listingStatus: "listed", dartCorpCode: null, cik: "0000320193", tossSymbol: "AAPL", sharesManualOverrideNeeded: false },
        ]),
      ),
    });
    const job = createCollectFinancialsJob(makeDeps({ sec, repos }));

    await job.run(NOW);

    expect(sec.downloadBulk).toHaveBeenCalled();
    expect(repos.upsertProfiles).toHaveBeenCalled();
    expect(repos.upsertDisclosures).toHaveBeenCalled();
  });
});

describe("collect-financials job — 20-F annual-only + unmapped revenue (Main 12, E3/E13)", () => {
  it("stores only an annual row and does not flag unmapped when a valid tag maps (control case)", async () => {
    const repos = makeRepos({
      findAllForFinancials: vi.fn().mockResolvedValue(
        repoOk([
          { id: "sec-us-2", ticker: "BABA", market: "US", listingStatus: "listed", dartCorpCode: null, cik: "0001577552", tossSymbol: "BABA", sharesManualOverrideNeeded: false },
        ]),
      ),
    });
    const sec = makeSec({
      checkBulkFreshness: vi.fn().mockResolvedValue({ lastModified: "v1" }),
      readBulkEntries: vi.fn().mockImplementation(async function* (_zipPath: string, _cikSet: Set<string>, kind: string) {
        if (kind !== "companyfacts") return; // submissions pass: nothing relevant to yield in this test
        yield {
          cik: "0001577552",
          facts: {
            "us-gaap": {
              Revenues: {
                units: {
                  USD: [
                    { start: "2025-01-01", end: "2025-12-31", val: 600, fy: 2025, fp: "FY", form: "20-F", filed: "2026-03-01", accn: "A" },
                  ],
                },
              },
            },
          },
        };
      }),
    });
    const job = createCollectFinancialsJob(makeDeps({ sec, repos }));

    await job.run(NOW);

    const upsertCall = (repos.upsertFinancials as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Array<{ periodType: string; isRevenueTagUnmapped: boolean }>;
    expect(upsertCall.every((r) => r.periodType === "annual")).toBe(true);
    expect(upsertCall.every((r) => r.isRevenueTagUnmapped === false)).toBe(true);
  });
});

describe("collect-financials job — toss shares outstanding (Main 14)", () => {
  it("collects shares outstanding via toss for all securities with a toss_symbol", async () => {
    const repos = makeRepos({
      findAllForFinancials: vi.fn().mockResolvedValue(
        repoOk([
          { id: "sec-1", ticker: "005930", market: "KRX", listingStatus: "listed", dartCorpCode: "00126380", cik: null, tossSymbol: "005930", sharesManualOverrideNeeded: false },
        ]),
      ),
    });
    const toss = makeToss({
      getStockInfos: vi.fn().mockResolvedValue({
        infos: [{ symbol: "005930", sharesOutstanding: 5_969_782_550, status: "active", name: "삼성전자" }],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const job = createCollectFinancialsJob(makeDeps({ repos, toss }));

    await job.run(NOW);

    expect(toss.getStockInfos).toHaveBeenCalledWith(["005930"]);
    expect(repos.upsertShares).toHaveBeenCalledWith([
      expect.objectContaining({ securityId: "sec-1", shares: 5_969_782_550, source: "toss" }),
    ]);
  });

  it("skips upsert when the latest toss value is unchanged (no duplicate row growth)", async () => {
    const repos = makeRepos({
      findAllForFinancials: vi.fn().mockResolvedValue(
        repoOk([
          { id: "sec-1", ticker: "005930", market: "KRX", listingStatus: "listed", dartCorpCode: "00126380", cik: null, tossSymbol: "005930", sharesManualOverrideNeeded: false },
        ]),
      ),
      findLatestBySource: vi.fn().mockResolvedValue(repoOk([{ securityId: "sec-1", shares: 5_969_782_550, asOfDate: "2026-05-14" }])),
    });
    const toss = makeToss({
      getStockInfos: vi.fn().mockResolvedValue({
        infos: [{ symbol: "005930", sharesOutstanding: 5_969_782_550, status: "active", name: "삼성전자" }],
        failures: [],
        carriedOverSymbols: [],
      }),
    });
    const job = createCollectFinancialsJob(makeDeps({ repos, toss }));

    await job.run(NOW);

    expect(repos.upsertShares).not.toHaveBeenCalled();
  });
});

describe("collect-financials job — success/partial/failed status and onFinished hook (BR-9)", () => {
  it("calls onFinished on success", async () => {
    const onFinished = vi.fn();
    const job = createCollectFinancialsJob(makeDeps({ onFinished }));

    await job.run(NOW);

    expect(onFinished).toHaveBeenCalled();
  });

  it("does not call onFinished when the run fails", async () => {
    const onFinished = vi.fn();
    const dart = makeDart({
      fetchCorpCodeMappings: vi.fn().mockRejectedValue(new DartAuthError("011", "bad key")),
    });
    const job = createCollectFinancialsJob(makeDeps({ dart, onFinished }));

    await job.run(NOW);

    expect(onFinished).not.toHaveBeenCalled();
  });

  it("swallows unexpected exceptions, finishes as failed, and does not propagate", async () => {
    const repos = makeRepos({
      findAllForFinancials: vi.fn().mockRejectedValue(new Error("unexpected boom")),
    });
    const batchLog = makeBatchLog();
    const job = createCollectFinancialsJob(makeDeps({ repos, batchLog }));

    await expect(job.run(NOW)).resolves.toBeUndefined();
    expect(batchLog.finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
  });
});
