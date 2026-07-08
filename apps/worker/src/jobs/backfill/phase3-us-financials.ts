/**
 * Phase 3 — 미국 과거 재무·공시·기업정보 백필 (docs/usecases/031/plan.md 모듈 18).
 * companyfacts.zip(과거 전 구간 이력)·submissions.zip(제출 이력+메타) 스트리밍 추출 →
 * UC-027과 동일 규칙(us-financials.ts)으로 정규화 → quarterly_financials·disclosures·company_profiles UPSERT.
 */
import {
  SEC_SHARES_TAG_CHAIN,
  US_DISCLOSURE_FORMS,
  US_REVENUE_TAG_CHAIN,
  buildUsQuarterRows,
  pickRevenueFacts,
  pickSharesOutstanding,
  resolveCalendarPeriod,
} from "@iib/domain";
import { SecBlockedError, type SecBulkKind, type SecCompanyFactsEntry, type SecSubmissionsEntry } from "../../adapters/sec-edgar/contract";
import type { RepoResult } from "../../repositories/result";
import type { CompanyProfileRow } from "../../repositories/company-profiles.repository";
import type { DisclosureRow } from "../../repositories/disclosures.repository";
import type { FinancialsRow } from "../../repositories/financials.repository";
import type { SharesRow } from "../../repositories/shares.repository";

export interface Phase3Target {
  id: string;
  cik: string;
}

export interface Phase3SecPort {
  checkBulkFreshness(kind: SecBulkKind): Promise<{ lastModified: string | null }>;
  downloadBulk(kind: SecBulkKind, destPath: string): Promise<void>;
  readBulkEntries(
    zipPath: string,
    cikSet: Set<string>,
    kind: SecBulkKind,
  ): AsyncIterable<SecSubmissionsEntry | SecCompanyFactsEntry | { cik: string; error: string }>;
}

export interface Phase3Repos {
  upsertFinancials(rows: FinancialsRow[]): Promise<RepoResult<{ affected: number; failedChunks: number }>>;
  upsertShares(rows: SharesRow[]): Promise<RepoResult<void>>;
  upsertDisclosures(rows: DisclosureRow[]): Promise<RepoResult<void>>;
  upsertProfiles(rows: CompanyProfileRow[]): Promise<RepoResult<void>>;
  flagSharesManualOverride(securityIds: string[]): Promise<RepoResult<void>>;
}

export interface Phase3Checkpoints {
  get(key: string): Promise<RepoResult<{ cursor: unknown; isCompleted: boolean } | null>>;
  upsert(key: string, cursor: unknown, isCompleted: boolean): Promise<RepoResult<void>>;
  complete(key: string): Promise<RepoResult<void>>;
}

export interface Phase3Guard {
  waitUntilIdle(runId: string): Promise<void>;
}

export interface Phase3BatchLog {
  itemFailures(failures: Array<{ securityId: string; attemptCount: number; lastError: string }>): Promise<void>;
}

export interface Phase3Deps {
  sec: Phase3SecPort;
  repos: Phase3Repos;
  checkpoints: Phase3Checkpoints;
  guard: Phase3Guard;
  batchLog: Phase3BatchLog;
  tmpDir?: string;
}

export interface Phase3Summary {
  processed: number;
  failed: number;
  carriedOver: boolean;
}

export interface Phase3Job {
  run(targets: Phase3Target[], runId?: string): Promise<Phase3Summary>;
}

function checkpointKeyFor(kind: SecBulkKind): string {
  return `phase3:${kind}`;
}

type FlatFacts = Record<string, Array<{ start: string; end: string; val: number; fy: number; fp: string; form: string; filed: string; accn: string }>>;

function flattenFacts(facts: Record<string, Record<string, unknown> | undefined>): FlatFacts {
  const flat: FlatFacts = {};
  for (const [taxonomy, tags] of Object.entries(facts)) {
    if (!tags) continue;
    for (const [tag, tagValue] of Object.entries(tags)) {
      const units = (tagValue as { units?: Record<string, unknown> } | undefined)?.units;
      if (!units) continue;
      const usdFacts = (units.USD ?? units.shares ?? Object.values(units)[0]) as FlatFacts[string] | undefined;
      if (!usdFacts) continue;
      flat[`${taxonomy}:${tag}`] = usdFacts;
    }
  }
  return flat;
}

function findQuarterPeriod(
  facts: Array<{ start: string; end: string; fy: number }>,
  fiscalYear: number,
  fiscalQuarter: number | null,
): { start: string; end: string } | null {
  const sameYear = facts.filter((f) => f.fy === fiscalYear);
  if (sameYear.length === 0) return null;
  const sorted = [...sameYear].sort((a, b) => a.start.localeCompare(b.start));
  if (fiscalQuarter === 4) {
    const last = sorted[sorted.length - 1];
    if (!last) return null;
    const nextDay = new Date(`${last.end}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return { start: nextDay.toISOString().slice(0, 10), end: `${fiscalYear}-12-31` };
  }
  const idx = (fiscalQuarter ?? 1) - 1;
  const match = sorted[idx];
  return match ? { start: match.start, end: match.end } : null;
}

function findAnnualPeriod(
  facts: Array<{ start: string; end: string; fy: number }>,
  fiscalYear: number,
): { start: string; end: string } | null {
  const match = facts.find((f) => f.fy === fiscalYear);
  return match ? { start: match.start, end: match.end } : null;
}

export function createPhase3UsFinancials(deps: Phase3Deps): Phase3Job {
  const { sec, repos, checkpoints, guard, batchLog } = deps;
  const tmpDir = deps.tmpDir ?? "/tmp";

  return {
    async run(targets: Phase3Target[], runId = "backfill"): Promise<Phase3Summary> {
      let processed = 0;
      let failed = 0;
      let carriedOver = false;

      const cikToTarget = new Map(targets.map((t) => [t.cik, t]));
      const cikSet = new Set(targets.map((t) => t.cik));

      for (const kind of ["submissions", "companyfacts"] as const) {
        await guard.waitUntilIdle(runId);
        const checkpointKey = checkpointKeyFor(kind);

        try {
          const freshness = await sec.checkBulkFreshness(kind);
          const stored = await checkpoints.get(checkpointKey);
          const storedValue = stored.ok && stored.data ? stored.data.cursor : null;

          if (freshness.lastModified !== null && stored.ok && stored.data?.isCompleted && freshness.lastModified === storedValue) {
            continue; // E1: 이미 처리된 버전 — 스킵(재개)
          }

          const tmpPath = `${tmpDir}/backfill-sec-${kind}-${Date.now()}.zip`;
          await sec.downloadBulk(kind, tmpPath);

          for await (const entry of sec.readBulkEntries(tmpPath, cikSet, kind)) {
            if ("error" in entry) {
              const target = cikToTarget.get(entry.cik);
              if (target) {
                await batchLog.itemFailures([
                  { securityId: target.id, attemptCount: 1, lastError: `SEC 엔트리 오류: ${entry.error}` },
                ]);
                failed += 1;
              }
              continue;
            }

            try {
              if (kind === "submissions") {
                await processSubmissionsEntry(entry as SecSubmissionsEntry);
              } else {
                await processCompanyFactsEntry(entry as SecCompanyFactsEntry);
              }
            } catch (entryError) {
              const entryCik = (entry as { cik?: string }).cik;
              const target = entryCik ? cikToTarget.get(entryCik) : undefined;
              if (target) {
                await batchLog.itemFailures([
                  { securityId: target.id, attemptCount: 1, lastError: `SEC 엔트리 처리 실패: ${(entryError as Error).message}` },
                ]);
                failed += 1;
              }
            }
          }

          if (freshness.lastModified !== null) {
            await checkpoints.upsert(checkpointKey, freshness.lastModified, true);
          }
        } catch (error) {
          if (error instanceof SecBlockedError) {
            carriedOver = true;
            continue; // E10: 이 벌크 종류는 이월, 다른 종류는 계속 시도
          }
          throw error;
        }
      }

      return { processed, failed, carriedOver };

      async function processSubmissionsEntry(entry: SecSubmissionsEntry): Promise<void> {
        const target = cikToTarget.get(entry.cik);
        if (!target) return;

        await repos.upsertProfiles([
          {
            securityId: target.id,
            representativeName: null,
            establishedDate: null,
            homepageUrl: null,
            sector: entry.sicDescription,
            industryCode: entry.sic,
            address: entry.businessAddress
              ? [entry.businessAddress.street1, entry.businessAddress.city, entry.businessAddress.stateOrCountry]
                  .filter(Boolean)
                  .join(", ")
              : null,
            phone: entry.phone,
          },
        ]);
        processed += 1;

        const disclosureRows: DisclosureRow[] = [];
        for (const filing of entry.recentFilings) {
          const baseForm = filing.form.replace(/\/A$/, "");
          if (!(US_DISCLOSURE_FORMS as readonly string[]).includes(baseForm)) continue;
          disclosureRows.push({
            securityId: target.id,
            source: "sec",
            externalId: filing.accessionNumber,
            title: filing.form,
            disclosureDate: filing.filingDate,
            url: null,
          });
        }
        if (disclosureRows.length > 0) {
          await repos.upsertDisclosures(disclosureRows);
          processed += disclosureRows.length;
        }
      }

      async function processCompanyFactsEntry(entry: SecCompanyFactsEntry): Promise<void> {
        const target = cikToTarget.get(entry.cik);
        if (!target) return;

        const flatFacts = flattenFacts(entry.facts);
        const revenueResult = pickRevenueFacts(flatFacts, US_REVENUE_TAG_CHAIN);
        const rows: FinancialsRow[] = [];

        if (!revenueResult.unmapped) {
          const { rows: quarterRows } = buildUsQuarterRows(revenueResult.facts);
          for (const row of quarterRows) {
            const rowPeriod =
              row.periodType === "annual"
                ? findAnnualPeriod(revenueResult.facts, row.fiscalYear)
                : findQuarterPeriod(revenueResult.facts, row.fiscalYear, row.fiscalQuarter);
            if (!rowPeriod) continue;
            const calendar = resolveCalendarPeriod(rowPeriod.start, rowPeriod.end, row.periodType);
            rows.push({
              securityId: target.id,
              periodType: row.periodType,
              fiscalYear: row.fiscalYear,
              fiscalQuarter: row.fiscalQuarter,
              periodStartDate: rowPeriod.start,
              periodEndDate: rowPeriod.end,
              calendarYear: calendar.calendarYear,
              calendarQuarter: calendar.calendarQuarter,
              currency: "USD",
              revenue: row.amount,
              operatingIncome: null,
              netIncome: null,
              amountBasis: row.amountBasis,
              revenueSourceTag: revenueResult.sourceTag,
              isRevenueTagUnmapped: false,
              source: "sec",
              disclosureRceptNo: null,
            });
          }
        }

        if (rows.length > 0) {
          const upsertResult = await repos.upsertFinancials(rows);
          if (upsertResult.ok) {
            processed += upsertResult.data.affected;
            failed += upsertResult.data.failedChunks;
          }
        }

        const sharesResult = pickSharesOutstanding(flatFacts, SEC_SHARES_TAG_CHAIN);
        if (sharesResult) {
          await repos.upsertShares([
            {
              securityId: target.id,
              shares: sharesResult.shares,
              asOfDate: sharesResult.asOfDate,
              source: "sec",
              sourceTag: sharesResult.sourceTag,
              isMultiClassPartial: sharesResult.isPartial,
            },
          ]);
          processed += 1;
        } else {
          await repos.flagSharesManualOverride([target.id]);
        }
      }
    },
  };
}
