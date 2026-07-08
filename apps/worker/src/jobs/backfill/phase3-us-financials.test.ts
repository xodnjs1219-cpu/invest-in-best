import { describe, expect, it, vi } from "vitest";
import { createPhase3UsFinancials } from "./phase3-us-financials";
import { repoOk } from "../../repositories/result";
import { SecBlockedError } from "../../adapters/sec-edgar/contract";

function makeSec(overrides: Record<string, unknown> = {}) {
  return {
    checkBulkFreshness: vi.fn().mockResolvedValue({ lastModified: "v1" }),
    downloadBulk: vi.fn().mockResolvedValue(undefined),
    readBulkEntries: vi.fn().mockImplementation(async function* () {
      /* empty */
    }),
    ...overrides,
  };
}

function makeRepos(overrides: Record<string, unknown> = {}) {
  return {
    upsertFinancials: vi.fn().mockResolvedValue(repoOk({ affected: 0, failedChunks: 0 })),
    upsertShares: vi.fn().mockResolvedValue(repoOk(undefined)),
    upsertDisclosures: vi.fn().mockResolvedValue(repoOk(undefined)),
    upsertProfiles: vi.fn().mockResolvedValue(repoOk(undefined)),
    flagSharesManualOverride: vi.fn().mockResolvedValue(repoOk(undefined)),
    ...overrides,
  };
}

function makeCheckpoints(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue(repoOk(null)),
    upsert: vi.fn().mockResolvedValue(repoOk(undefined)),
    complete: vi.fn().mockResolvedValue(repoOk(undefined)),
    ...overrides,
  };
}

function makeGuard() {
  return { waitUntilIdle: vi.fn().mockResolvedValue(undefined) };
}

function makeBatchLog() {
  return { itemFailures: vi.fn().mockResolvedValue(undefined) };
}

const targets = [{ id: "sec-1", cik: "0000320193" }];

describe("phase3-us-financials — companyfacts + submissions bulk processing", () => {
  it("processes companyfacts entries for target CIKs and upserts financials", async () => {
    const sec = makeSec({
      readBulkEntries: vi.fn().mockImplementation(async function* (_path: string, _cikSet: Set<string>, kind: string) {
        if (kind !== "companyfacts") return;
        yield {
          cik: "0000320193",
          facts: {
            "us-gaap": {
              Revenues: {
                units: {
                  USD: [{ start: "2025-01-01", end: "2025-03-31", val: 100, fy: 2025, fp: "Q1", form: "10-Q", filed: "2025-04-01", accn: "a1" }],
                },
              },
            },
          },
        };
      }),
    });
    const repos = makeRepos();

    const phase3 = createPhase3UsFinancials({ sec, repos, checkpoints: makeCheckpoints(), guard: makeGuard(), batchLog: makeBatchLog() });
    await phase3.run(targets);

    expect(repos.upsertFinancials).toHaveBeenCalled();
  });

  it("processes submissions entries and upserts company_profiles + disclosures", async () => {
    const sec = makeSec({
      readBulkEntries: vi.fn().mockImplementation(async function* (_path: string, _cikSet: Set<string>, kind: string) {
        if (kind !== "submissions") return;
        yield {
          cik: "0000320193",
          name: "Apple Inc.",
          sic: "3571",
          sicDescription: "Electronic Computers",
          stateOfIncorporationDescription: "CA",
          businessAddress: { street1: "1 Apple Park", city: "Cupertino", stateOrCountry: "CA", zipCode: "95014" },
          phone: "408-996-1010",
          fiscalYearEnd: "0926",
          recentFilings: [{ accessionNumber: "0000320193-26-000013", form: "10-Q", filingDate: "2026-05-01", primaryDocument: "a.htm" }],
        };
      }),
    });
    const repos = makeRepos();

    const phase3 = createPhase3UsFinancials({ sec, repos, checkpoints: makeCheckpoints(), guard: makeGuard(), batchLog: makeBatchLog() });
    await phase3.run(targets);

    expect(repos.upsertProfiles).toHaveBeenCalled();
    expect(repos.upsertDisclosures).toHaveBeenCalled();
  });

  it("skips bulk download when Last-Modified is unchanged from the stored checkpoint (E1 resume)", async () => {
    const sec = makeSec({ checkBulkFreshness: vi.fn().mockResolvedValue({ lastModified: "same" }) });
    const checkpoints = makeCheckpoints({
      get: vi.fn().mockResolvedValue(repoOk({ cursor: "same", isCompleted: true })),
    });

    const phase3 = createPhase3UsFinancials({ sec, repos: makeRepos(), checkpoints, guard: makeGuard(), batchLog: makeBatchLog() });
    await phase3.run(targets);

    expect(sec.downloadBulk).not.toHaveBeenCalled();
  });

  it("flags shares_manual_override_needed when the shares fallback chain fails entirely (E16)", async () => {
    const sec = makeSec({
      readBulkEntries: vi.fn().mockImplementation(async function* (_path: string, _cikSet: Set<string>, kind: string) {
        if (kind !== "companyfacts") return;
        yield { cik: "0000320193", facts: {} };
      }),
    });
    const repos = makeRepos();

    const phase3 = createPhase3UsFinancials({ sec, repos, checkpoints: makeCheckpoints(), guard: makeGuard(), batchLog: makeBatchLog() });
    await phase3.run(targets);

    expect(repos.flagSharesManualOverride).toHaveBeenCalledWith(["sec-1"]);
  });

  it("isolates a per-entry error (Zod failure) instead of aborting the whole bulk walk (E9/E13)", async () => {
    const sec = makeSec({
      readBulkEntries: vi.fn().mockImplementation(async function* (_path: string, _cikSet: Set<string>, kind: string) {
        if (kind !== "companyfacts") return;
        yield { cik: "0000320193", error: "malformed JSON" };
      }),
    });
    const repos = makeRepos();
    const batchLog = makeBatchLog();

    const phase3 = createPhase3UsFinancials({ sec, repos, checkpoints: makeCheckpoints(), guard: makeGuard(), batchLog });
    const summary = await phase3.run(targets);

    expect(batchLog.itemFailures).toHaveBeenCalled();
    expect(summary.failed).toBeGreaterThan(0);
  });

  it("propagates a carriedOver=true summary when SEC blocks the request (E10)", async () => {
    const sec = makeSec({ downloadBulk: vi.fn().mockRejectedValue(new SecBlockedError("user_agent", "blocked")) });
    const phase3 = createPhase3UsFinancials({
      sec,
      repos: makeRepos(),
      checkpoints: makeCheckpoints(),
      guard: makeGuard(),
      batchLog: makeBatchLog(),
    });

    const summary = await phase3.run(targets);
    expect(summary.carriedOver).toBe(true);
  });
});
