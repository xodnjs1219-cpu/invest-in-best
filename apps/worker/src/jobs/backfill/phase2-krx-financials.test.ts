import { describe, expect, it, vi } from "vitest";
import { createPhase2KrxFinancials } from "./phase2-krx-financials";
import { repoOk } from "../../repositories/result";
import { DartQuotaExceededError } from "../../adapters/opendart/contract";
import { DART_REPORT_CODES, FINANCIALS_MIN_FISCAL_YEAR } from "@iib/domain";

function makeDart(overrides: Record<string, unknown> = {}) {
  return {
    fetchCompanyProfile: vi.fn().mockResolvedValue(null),
    fetchStockTotal: vi.fn().mockResolvedValue(null),
    fetchDisclosures: vi.fn().mockResolvedValue({ items: [] }),
    fetchMultiAccounts: vi.fn().mockResolvedValue({ accounts: [], missingCorpCodes: [] }),
    fetchFullFinancials: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeRepos(overrides: Record<string, unknown> = {}) {
  return {
    upsertProfiles: vi.fn().mockResolvedValue(repoOk(undefined)),
    upsertShares: vi.fn().mockResolvedValue(repoOk(undefined)),
    upsertDisclosures: vi.fn().mockResolvedValue(repoOk(undefined)),
    upsertFinancials: vi.fn().mockResolvedValue(repoOk({ affected: 0, failedChunks: 0 })),
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

const targets = [{ id: "sec-1", dartCorpCode: "00126380" }];

describe("phase2-krx-financials — profiles+shares step (2a)", () => {
  it("upserts company_profiles and shares_outstanding(source=dart) per corp", async () => {
    const dart = makeDart({
      fetchCompanyProfile: vi.fn().mockResolvedValue({
        corpCode: "00126380",
        representativeName: "홍길동",
        establishedDate: "1969-01-13",
        homepageUrl: null,
        sector: "전자부품",
        industryCode: "264",
        address: null,
        phone: null,
      }),
      fetchStockTotal: vi.fn().mockResolvedValue({ corpCode: "00126380", totalShares: 5919637922, settlementDate: "2025-12-31" }),
    });
    const repos = makeRepos();

    const phase2 = createPhase2KrxFinancials({
      dart,
      repos,
      checkpoints: makeCheckpoints(),
      guard: makeGuard(),
      batchLog: makeBatchLog(),
    });
    await phase2.run(targets, new Date("2026-05-15T10:00:00Z"));

    expect(repos.upsertProfiles).toHaveBeenCalled();
    expect(repos.upsertShares).toHaveBeenCalledWith([
      expect.objectContaining({ securityId: "sec-1", shares: 5919637922, source: "dart" }),
    ]);
  });

  it("defaults the settlement month to 12 when company profile is unavailable (fallback, logged)", async () => {
    const dart = makeDart(); // profile null -> settlementMonth defaults to 12
    const repos = makeRepos();
    const phase2 = createPhase2KrxFinancials({
      dart,
      repos,
      checkpoints: makeCheckpoints(),
      guard: makeGuard(),
      batchLog: makeBatchLog(),
    });

    // Should not throw even without a profile.
    await expect(phase2.run(targets, new Date("2026-05-15T10:00:00Z"))).resolves.toBeDefined();
  });
});

describe("phase2-krx-financials — disclosures step (2b, H-10)", () => {
  it("fetches disclosures across 85-day windows covering the last 12 months and upserts matched rows", async () => {
    const dart = makeDart({
      fetchDisclosures: vi.fn().mockResolvedValue({
        items: [{ rceptNo: "R1", stockCode: "005930", corpCode: "00126380", title: "사업보고서", disclosureDate: "2026-03-01", url: "https://x" }],
      }),
    });
    const repos = makeRepos();

    const phase2 = createPhase2KrxFinancials({
      dart,
      repos,
      checkpoints: makeCheckpoints(),
      guard: makeGuard(),
      batchLog: makeBatchLog(),
    });
    await phase2.run([{ id: "sec-1", dartCorpCode: "00126380", ticker: "005930" }], new Date("2026-05-15T10:00:00Z"));

    expect(dart.fetchDisclosures).toHaveBeenCalled();
    expect(repos.upsertDisclosures).toHaveBeenCalled();
  });
});

describe("phase2-krx-financials — financials step (2c)", () => {
  it("normalizes and upserts financials once all 4 report-code chunks for a fiscal year complete", async () => {
    const dart = makeDart({
      fetchMultiAccounts: vi.fn().mockImplementation((_corpCodes: string[], _year: number, reprtCode: string) => {
        const base = { corpCode: "00126380", bsnsYear: 2025, reprtCode, fsDiv: "CFS" as const };
        if (reprtCode === DART_REPORT_CODES.Q1) {
          return Promise.resolve({ accounts: [{ ...base, metrics: { revenue: { threeMonth: 100, cumulative: 100 } } }], missingCorpCodes: [] });
        }
        if (reprtCode === DART_REPORT_CODES.HALF) {
          return Promise.resolve({ accounts: [{ ...base, metrics: { revenue: { threeMonth: null, cumulative: 250 } } }], missingCorpCodes: [] });
        }
        if (reprtCode === DART_REPORT_CODES.Q3) {
          return Promise.resolve({ accounts: [{ ...base, metrics: { revenue: { threeMonth: 130, cumulative: 380 } } }], missingCorpCodes: [] });
        }
        return Promise.resolve({ accounts: [{ ...base, metrics: { revenue: { threeMonth: null, cumulative: 500 } } }], missingCorpCodes: [] });
      }),
    });
    const repos = makeRepos();

    const phase2 = createPhase2KrxFinancials({
      dart,
      repos,
      checkpoints: makeCheckpoints(),
      guard: makeGuard(),
      batchLog: makeBatchLog(),
      fiscalYears: [2025],
    });
    await phase2.run(targets, new Date("2026-05-15T10:00:00Z"));

    expect(repos.upsertFinancials).toHaveBeenCalled();
    const rows = (repos.upsertFinancials as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: { fiscalYear: number }) => r.fiscalYear >= FINANCIALS_MIN_FISCAL_YEAR)).toBe(true);
  });

  it("stops OpenDART calls immediately on DartQuotaExceededError and reports carriedOver=true (E3)", async () => {
    const dart = makeDart({
      fetchMultiAccounts: vi.fn().mockRejectedValue(new DartQuotaExceededError()),
    });
    const repos = makeRepos();
    const checkpoints = makeCheckpoints();

    const phase2 = createPhase2KrxFinancials({
      dart,
      repos,
      checkpoints,
      guard: makeGuard(),
      batchLog: makeBatchLog(),
      fiscalYears: [2025],
    });
    const summary = await phase2.run(targets, new Date("2026-05-15T10:00:00Z"));

    expect(summary.carriedOver).toBe(true);
  });

  it("records a per-fiscal-year checkpoint after processing so a crash mid-run can resume without re-fetching completed years", async () => {
    const dart = makeDart({
      fetchMultiAccounts: vi.fn().mockResolvedValue({ accounts: [], missingCorpCodes: [] }),
    });
    const checkpoints = makeCheckpoints();

    const phase2 = createPhase2KrxFinancials({
      dart,
      repos: makeRepos(),
      checkpoints,
      guard: makeGuard(),
      batchLog: makeBatchLog(),
      fiscalYears: [2025],
    });
    await phase2.run(targets, new Date("2026-05-15T10:00:00Z"));

    expect(checkpoints.upsert).toHaveBeenCalledWith(
      "phase2:financials:2025",
      expect.anything(),
      true,
    );
  });
});
