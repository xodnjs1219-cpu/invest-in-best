import { describe, expect, it, vi } from "vitest";
import * as yauzl from "yauzl";
import { createOpenDartClient } from "./client";
import { createRateLimiter } from "../../runtime/rate-limiter";
import {
  DartAuthError,
  DartQuotaExceededError,
} from "./contract";
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeRateLimiter(clock: ReturnType<typeof makeClock>["clock"]) {
  return createRateLimiter({ groups: { OPENDART: { tps: 8 } }, clock });
}

/** Build a minimal valid ZIP buffer containing a single file, using yauzl's sibling `yazl`-free manual construction
 * is avoided — instead we build via Node's zlib + a tiny hand-rolled ZIP writer since no zip-writing lib is a dependency.
 * Simpler: use a pre-built base64 ZIP fixture containing CORPCODE.xml (built once, embedded here).
 */
function buildZipWithEntry(entryName: string, content: string): Buffer {
  // Minimal ZIP (store, no compression) — enough for yauzl to read back.
  const contentBuf = Buffer.from(content, "utf-8");
  const crc = crc32(contentBuf);
  const nameBuf = Buffer.from(entryName, "utf-8");

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8); // no compression
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(contentBuf.length, 18);
  localHeader.writeUInt32LE(contentBuf.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const localEntry = Buffer.concat([localHeader, nameBuf, contentBuf]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(contentBuf.length, 20);
  centralHeader.writeUInt32LE(contentBuf.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const centralEntry = Buffer.concat([centralHeader, nameBuf]);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  endRecord.writeUInt32LE(centralEntry.length, 12);
  endRecord.writeUInt32LE(localEntry.length, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localEntry, centralEntry, endRecord]);
}

// Simple CRC32 implementation (no dependency needed for a small test fixture).
function crc32(buf: Buffer): number {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

describe("createOpenDartClient — request pipeline & status handling", () => {
  it("includes crtfc_key in every request URL", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: "000", message: "정상", list: [] }));
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    await client.fetchDisclosures("20260101", "20260101");

    const [url] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain(`crtfc_key=${config.opendartApiKey}`);
  });

  it("throws DartQuotaExceededError without retry on status 020 (E1)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: "020", message: "한도 초과" }));
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    await expect(client.fetchDisclosures("20260101", "20260101")).rejects.toThrow(DartQuotaExceededError);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no retry
  });

  it("retries on status 800 (maintenance) and succeeds on eventual recovery (E19)", async () => {
    const { clock, sleeps } = makeClock();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "800", message: "점검 중" }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "000",
          message: "정상",
          list: [],
          total_page: 1,
        }),
      );
    const client = createOpenDartClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
      retryOptions: { retries: 3, sleep: clock.sleep },
    });

    const result = await client.fetchDisclosures("20260101", "20260101");
    expect(result.items).toEqual([]);
    expect(sleeps.length).toBeGreaterThan(0);
  });

  it("throws DartAuthError on status 011 (unusable key)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: "011", message: "사용할 수 없는 키" }));
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    await expect(client.fetchDisclosures("20260101", "20260101")).rejects.toThrow(DartAuthError);
  });

  it("paginates list.json across total_page and merges results", async () => {
    const { clock } = makeClock();
    const page1 = {
      status: "000",
      message: "정상",
      list: [
        { rcept_no: "1", corp_code: "00000001", stock_code: "000001", report_nm: "A", rcept_dt: "20260101" },
      ],
      total_page: 2,
    };
    const page2 = {
      status: "000",
      message: "정상",
      list: [
        { rcept_no: "2", corp_code: "00000002", stock_code: "000002", report_nm: "B", rcept_dt: "20260101" },
      ],
      total_page: 2,
    };
    const fetchImpl = vi
      .fn()
      .mockImplementation((url: string) => {
        const u = new URL(url);
        const pageNo = u.searchParams.get("page_no");
        return Promise.resolve(jsonResponse(pageNo === "2" ? page2 : page1));
      });
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const result = await client.fetchDisclosures("20260101", "20260101");
    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.rceptNo)).toEqual(["1", "2"]);
  });

  it("excludes unlisted-company disclosures (empty stock_code)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "000",
        message: "정상",
        list: [
          { rcept_no: "1", corp_code: "00000001", stock_code: "", report_nm: "비상장", rcept_dt: "20260101" },
          { rcept_no: "2", corp_code: "00000002", stock_code: "000002", report_nm: "상장", rcept_dt: "20260101" },
        ],
        total_page: 1,
      }),
    );
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const result = await client.fetchDisclosures("20260101", "20260101");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.rceptNo).toBe("2");
  });

  it("splits 250 corp codes into 100/100/50 chunks for fetchMultiAccounts", async () => {
    const { clock } = makeClock();
    const corpCodes = Array.from({ length: 250 }, (_, i) => String(i).padStart(8, "0"));
    const fetchImpl = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ status: "000", message: "정상", list: [] })),
    );
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    await client.fetchMultiAccounts(corpCodes, 2025, "11013");

    const calls = fetchImpl.mock.calls.filter(([url]) => String(url).includes("fnlttMultiAcnt"));
    expect(calls).toHaveLength(3);
    const sizes = calls.map(([url]) => new URL(String(url)).searchParams.get("corp_code")!.split(",").length);
    expect(sizes).toEqual([100, 100, 50]);
  });

  it("shrinks the chunk and retries on status 021 (too many companies, E18)", async () => {
    const { clock } = makeClock();
    const corpCodes = Array.from({ length: 100 }, (_, i) => String(i).padStart(8, "0"));
    let callCount = 0;
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      callCount += 1;
      const u = new URL(url);
      const requested = u.searchParams.get("corp_code")!.split(",");
      if (requested.length > 50) {
        return Promise.resolve(jsonResponse({ status: "021", message: "회사 수 초과" }));
      }
      return Promise.resolve(jsonResponse({ status: "000", message: "정상", list: [] }));
    });
    const client = createOpenDartClient({
      config,
      rateLimiter: makeRateLimiter(clock),
      fetchImpl,
      clock,
      retryOptions: { retries: 3, sleep: clock.sleep },
    });

    await client.fetchMultiAccounts(corpCodes, 2025, "11013");
    expect(callCount).toBeGreaterThan(1); // at least one retry with a smaller chunk
  });

  it("reports missing corp codes as missingCorpCodes, not a failure", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "000",
        message: "정상",
        list: [
          { corp_code: "00000001", sj_div: "IS", account_nm: "매출액", thstrm_amount: "100", thstrm_add_amount: "300" },
        ],
      }),
    );
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const result = await client.fetchMultiAccounts(["00000001", "00000002"], 2025, "11013");
    expect(result.accounts).toHaveLength(1);
    expect(result.missingCorpCodes).toEqual(["00000002"]);
  });

  it("falls back from CFS to OFS on status 013, and returns null if both are 013 (BR-11/E4)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      const u = new URL(url);
      const fsDiv = u.searchParams.get("fs_div");
      if (fsDiv === "CFS") return Promise.resolve(jsonResponse({ status: "013", message: "데이터 없음" }));
      return Promise.resolve(jsonResponse({ status: "013", message: "데이터 없음" }));
    });
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const result = await client.fetchFullFinancials("00000001", 2025, "11013");
    expect(result).toBeNull();

    const calls = fetchImpl.mock.calls.filter(([url]) => String(url).includes("fnlttSinglAcntAll"));
    expect(calls.map(([url]) => new URL(String(url)).searchParams.get("fs_div"))).toEqual(["CFS", "OFS"]);
  });

  it("succeeds with OFS data when CFS returns 013", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      const u = new URL(url);
      const fsDiv = u.searchParams.get("fs_div");
      if (fsDiv === "CFS") return Promise.resolve(jsonResponse({ status: "013", message: "데이터 없음" }));
      return Promise.resolve(
        jsonResponse({
          status: "000",
          message: "정상",
          list: [
            { corp_code: "00000001", sj_div: "IS", account_nm: "매출액", thstrm_amount: "500", thstrm_add_amount: "1500" },
          ],
        }),
      );
    });
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const result = await client.fetchFullFinancials("00000001", 2025, "11013");
    expect(result?.fsDiv).toBe("OFS");
    expect(result?.metrics.revenue).toEqual({ threeMonth: 500, cumulative: 1500 });
  });

  it("returns null for fetchStockTotal on status 013 (no data yet)", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: "013", message: "데이터 없음" }));
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    expect(await client.fetchStockTotal("00000001", 2025, "11013")).toBeNull();
  });

  it("returns null for fetchCompanyProfile on status 013", async () => {
    const { clock } = makeClock();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: "013", message: "데이터 없음" }));
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    expect(await client.fetchCompanyProfile("00000001")).toBeNull();
  });

  it("fetches and parses corpCode.xml from a ZIP buffer, returning only listed companies", async () => {
    const { clock } = makeClock();
    const xml = `<?xml version="1.0" encoding="UTF-8"?><result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><corp_eng_name>Samsung</corp_eng_name><stock_code>005930</stock_code><modify_date>20260101</modify_date></list><list><corp_code>00999999</corp_code><corp_name>Unlisted</corp_name><corp_eng_name></corp_eng_name><stock_code></stock_code><modify_date>20260102</modify_date></list></result>`;
    const zipBuffer = buildZipWithEntry("CORPCODE.xml", xml);

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(zipBuffer, { status: 200, headers: { "content-type": "application/x-zip-compressed" } }),
    );
    const client = createOpenDartClient({ config, rateLimiter: makeRateLimiter(clock), fetchImpl, clock });

    const mappings = await client.fetchCorpCodeMappings();
    expect(mappings).toEqual([
      { corpCode: "00126380", stockCode: "005930", corpName: "삼성전자", modifyDate: "20260101" },
    ]);
  });
});

// Sanity check that our hand-rolled ZIP fixture is readable by yauzl at all (guards the test helper itself).
describe("test fixture sanity", () => {
  it("buildZipWithEntry produces a ZIP yauzl can open", async () => {
    const buf = buildZipWithEntry("test.txt", "hello");
    await new Promise<void>((resolve, reject) => {
      yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err ?? new Error("no zipfile"));
        zipfile.readEntry();
        zipfile.on("entry", (entry) => {
          expect(entry.fileName).toBe("test.txt");
          resolve();
        });
      });
    });
  });
});
