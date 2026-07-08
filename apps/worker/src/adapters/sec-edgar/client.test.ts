import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSecEdgarClient } from "./client";
import { createRateLimiter } from "../../runtime/rate-limiter";
import { SecBlockedError, SecRequestError } from "./contract";
import type { WorkerConfig } from "../../runtime/config";

const config: WorkerConfig = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role-key",
  tossClientId: "client-id",
  tossClientSecret: "client-secret",
  opendartApiKey: "a".repeat(40),
  secEdgarUserAgent: "InvestInBest admin@example.com",
  workerTmpDir: undefined,
};

function makeClock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    clock: {
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        now += ms;
      },
    },
    sleeps,
  };
}

function makeRateLimiter(clock: ReturnType<typeof makeClock>["clock"]) {
  return createRateLimiter({ groups: { SEC: { tps: 6 } }, clock });
}

let tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

function makeTmpDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "sec-edgar-test-"));
  tmpDirs.push(dir);
  return dir;
}

describe("createSecEdgarClient — headers & rate limit", () => {
  it("includes the User-Agent header on every request", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ units: {} }), { status: 200 }),
    );
    const client = createSecEdgarClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    await client.fetchCompanyConcept("0000320193", "dei", "EntityCommonStockSharesOutstanding");

    const [, init] = fetchImpl.mock.calls[0]!;
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(config.secEdgarUserAgent);
  });

  it("acquires the SEC rate limit bucket before each request", async () => {
    const { clock } = makeClock();
    const rateLimiter = makeRateLimiter(clock);
    const acquireSpy = vi.spyOn(rateLimiter, "acquire");
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ units: {} }), { status: 200 }));
    const client = createSecEdgarClient({ config, rateLimiter, fetchImpl, clock });

    await client.fetchCompanyConcept("0000320193", "dei", "EntityCommonStockSharesOutstanding");
    expect(acquireSpy).toHaveBeenCalledWith("SEC");
  });

  it("checkBulkFreshness issues a HEAD request and returns Last-Modified", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 200, headers: { "Last-Modified": "Fri, 03 Jul 2026 22:19:12 GMT" } }),
    );
    const client = createSecEdgarClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const result = await client.checkBulkFreshness("submissions");
    expect(result.lastModified).toBe("Fri, 03 Jul 2026 22:19:12 GMT");
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init.method).toBe("HEAD");
  });
});

describe("createSecEdgarClient — error mapping", () => {
  it("throws SecBlockedError(user_agent) on 403 with 'Undeclared Automated Tool' body", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("Undeclared Automated Tool", { status: 403 }),
    );
    const client = createSecEdgarClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    await expect(
      client.fetchCompanyConcept("0000320193", "dei", "EntityCommonStockSharesOutstanding"),
    ).rejects.toThrow(SecBlockedError);
  });

  it("fetchCompanyConcept returns null on 404 without retrying (E11)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    const client = createSecEdgarClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const result = await client.fetchCompanyConcept("0000320193", "dei", "EntityCommonStockSharesOutstanding");
    expect(result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx and returns normally on eventual success (E10)", async () => {
    const { clock, sleeps } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("oops", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ units: { USD: [] } }), { status: 200 }));
    const client = createSecEdgarClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
      retryOptions: { retries: 3, sleep: clock.sleep },
    });

    const result = await client.fetchCompanyConcept("0000320193", "dei", "EntityCommonStockSharesOutstanding");
    expect(result).not.toBeNull();
    expect(sleeps.length).toBeGreaterThan(0);
  });

  it("throws SecRequestError for other non-2xx/404 statuses", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    const client = createSecEdgarClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
      retryOptions: { retries: 0 },
    });

    await expect(
      client.fetchCompanyConcept("0000320193", "dei", "EntityCommonStockSharesOutstanding"),
    ).rejects.toThrow(SecRequestError);
  });
});

describe("createSecEdgarClient — bulk ZIP streaming", () => {
  it("downloads a bulk file to destPath via streaming", async () => {
    const destDir = makeTmpDir();
    const destPath = path.join(destDir, "submissions.zip");
    const { clock } = makeClock();
    const bodyContent = new TextEncoder().encode("fake-zip-content");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(bodyContent, { status: 200 }),
    );
    const client = createSecEdgarClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    await client.downloadBulk("submissions", destPath);

    const fs = await import("node:fs");
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(0);
  });

  it("readBulkEntries yields only entries matching the target CIK set, skipping others without opening their stream", async () => {
    const { buildZipWithEntries } = await import("./__fixtures__/zip-fixture");
    const destDir = makeTmpDir();
    const zipPath = path.join(destDir, "submissions.zip");
    const fs = await import("node:fs");
    fs.writeFileSync(
      zipPath,
      buildZipWithEntries([
        { name: "CIK0000320193.json", content: JSON.stringify({ cik: "0000320193", name: "Apple Inc.", filings: { recent: { accessionNumber: [], form: [], filingDate: [], primaryDocument: [] } } }) },
        { name: "CIK0000999999.json", content: JSON.stringify({ cik: "0000999999", name: "Not Wanted", filings: { recent: { accessionNumber: [], form: [], filingDate: [], primaryDocument: [] } } }) },
      ]),
    );
    const { clock } = makeClock();
    const client = createSecEdgarClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl: vi.fn(), clock });

    const results = [];
    for await (const entry of client.readBulkEntries(zipPath, new Set(["0000320193"]), "submissions")) {
      results.push(entry);
    }

    expect(results).toHaveLength(1);
    expect((results[0] as { cik: string }).cik).toBe("0000320193");
  });

  it("readBulkEntries yields an error entry for malformed JSON and continues (E9)", async () => {
    const { buildZipWithEntries } = await import("./__fixtures__/zip-fixture");
    const destDir = makeTmpDir();
    const zipPath = path.join(destDir, "submissions.zip");
    const fs = await import("node:fs");
    fs.writeFileSync(
      zipPath,
      buildZipWithEntries([
        { name: "CIK0000111111.json", content: "{ not valid json" },
        { name: "CIK0000222222.json", content: JSON.stringify({ cik: "0000222222", name: "Valid Co", filings: { recent: { accessionNumber: [], form: [], filingDate: [], primaryDocument: [] } } }) },
      ]),
    );
    const { clock } = makeClock();
    const client = createSecEdgarClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl: vi.fn(), clock });

    const results = [];
    for await (const entry of client.readBulkEntries(
      zipPath,
      new Set(["0000111111", "0000222222"]),
      "submissions",
    )) {
      results.push(entry);
    }

    expect(results).toHaveLength(2);
    const errorEntry = results.find((r) => "error" in r);
    const okEntry = results.find((r) => "name" in r);
    expect(errorEntry).toBeDefined();
    expect(okEntry).toBeDefined();
  });
});
