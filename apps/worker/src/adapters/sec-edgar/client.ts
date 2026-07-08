/**
 * SEC EDGAR 어댑터 구현 (docs/usecases/027/plan.md 모듈 10).
 * 【외부 서비스 연동 모듈 — SEC EDGAR API】
 * Last-Modified 조건부 확인, 벌크 ZIP 스트리밍 다운로드+yauzl 선택 추출, companyconcept(404=null),
 * User-Agent 필수 주입, 토큰버킷·차단 백오프.
 */
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import * as yauzl from "yauzl";
import { WORKER_HTTP_TIMEOUT_MS } from "@iib/domain";
import type { WorkerConfig } from "../../runtime/config";
import type { RateLimiter } from "../../runtime/rate-limiter";
import { withRetry, type RetryOptions } from "../../runtime/retry";
import {
  SecBlockedError,
  SecRequestError,
  type SecBulkFreshness,
  type SecBulkKind,
  type SecConceptResult,
  type SecEdgarPort,
  type SecSubmissionsEntry,
} from "./contract";
import { normalizeCik, parseSubmissionsResponse, toSecSubmissionsEntry } from "./dto";

const DATA_BASE_URL = "https://data.sec.gov";
const WWW_BASE_URL = "https://www.sec.gov";

/** SEC 차단 감지 시 보수적 백오프(공식 문서 "brief period"만 명시 — 안전하게 5분). */
export const SEC_BLOCK_BACKOFF_MS = 5 * 60 * 1000;

const BULK_PATHS: Record<SecBulkKind, string> = {
  submissions: "/Archives/edgar/daily-index/bulkdata/submissions.zip",
  companyfacts: "/Archives/edgar/daily-index/xbrl/companyfacts.zip",
};

export interface SecEdgarClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const defaultClock: SecEdgarClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface CreateSecEdgarClientOptions {
  config: WorkerConfig;
  rateLimiter: RateLimiter;
  fetchImpl?: typeof fetch;
  clock?: SecEdgarClock;
  retryOptions?: Partial<RetryOptions>;
}

function shouldRetrySecError(error: unknown): boolean {
  if (error instanceof SecBlockedError) return true; // 백오프 후 재시도(retryAfterMs로 유도)
  if (error instanceof SecRequestError) return error.status >= 500;
  return true;
}

export function createSecEdgarClient(options: CreateSecEdgarClientOptions): SecEdgarPort {
  const { config, rateLimiter } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const clock = options.clock ?? defaultClock;
  const retryOptions: RetryOptions = {
    sleep: clock.sleep.bind(clock),
    shouldRetry: shouldRetrySecError,
    ...options.retryOptions,
  };

  function baseHeaders(): Record<string, string> {
    return {
      "User-Agent": config.secEdgarUserAgent,
      "Accept-Encoding": "gzip, deflate",
    };
  }

  async function detectBlocked(response: Response): Promise<SecBlockedError | null> {
    if (response.status === 403) {
      const text = await response.clone().text().catch(() => "");
      if (text.includes("Undeclared Automated Tool")) {
        return new SecBlockedError("user_agent", "SEC User-Agent 미선언/부적합 차단");
      }
      return new SecBlockedError("user_agent", "SEC 403 차단(사유 불명)");
    }
    if (response.status === 429) {
      return new SecBlockedError("rate_limit", "SEC 레이트리밋 차단");
    }
    return null;
  }

  async function requestJson(url: string): Promise<unknown> {
    await rateLimiter.acquire("SEC");
    const response = await fetchImpl(url, {
      method: "GET",
      headers: baseHeaders(),
      signal: AbortSignal.timeout(WORKER_HTTP_TIMEOUT_MS),
    });
    const blocked = await detectBlocked(response);
    if (blocked) {
      (blocked as unknown as { retryAfterMs: number }).retryAfterMs = SEC_BLOCK_BACKOFF_MS;
      throw blocked;
    }
    if (response.status === 404) {
      return null; // 호출부가 404 신호를 구분해서 처리
    }
    if (!response.ok) {
      throw new SecRequestError(response.status, `HTTP ${response.status}`);
    }
    return response.json();
  }

  return {
    async checkBulkFreshness(kind: SecBulkKind): Promise<SecBulkFreshness> {
      await rateLimiter.acquire("SEC");
      const response = await fetchImpl(`${WWW_BASE_URL}${BULK_PATHS[kind]}`, {
        method: "HEAD",
        headers: baseHeaders(),
        signal: AbortSignal.timeout(WORKER_HTTP_TIMEOUT_MS),
      });
      const lastModified = response.headers.get("Last-Modified");
      return { lastModified };
    },

    async downloadBulk(kind: SecBulkKind, destPath: string): Promise<void> {
      await rateLimiter.acquire("SEC");
      const response = await fetchImpl(`${WWW_BASE_URL}${BULK_PATHS[kind]}`, {
        method: "GET",
        headers: baseHeaders(),
      });
      const blocked = await detectBlocked(response);
      if (blocked) throw blocked;
      if (!response.ok || !response.body) {
        throw new SecRequestError(response.status, `벌크 다운로드 실패: HTTP ${response.status}`);
      }
      const nodeReadable = Readable.fromWeb(response.body as never);
      await pipeline(nodeReadable, createWriteStream(destPath));
    },

    async *readBulkEntries(zipPath, cikSet, _kind) {
      const zipfile = await openZip(zipPath);
      try {
        for await (const { fileName, content, error } of iterateZipEntries(zipfile, cikSet)) {
          if (error) {
            const cik = extractCikFromFileName(fileName);
            yield { cik, error };
            continue;
          }
          try {
            const raw: unknown = JSON.parse(content!);
            const parsed = parseSubmissionsResponse(raw);
            if (!parsed.ok) {
              yield { cik: extractCikFromFileName(fileName), error: parsed.error };
              continue;
            }
            yield toSecSubmissionsEntry(parsed.data) satisfies SecSubmissionsEntry;
          } catch (parseError) {
            yield {
              cik: extractCikFromFileName(fileName),
              error: (parseError as Error).message,
            };
          }
        }
      } finally {
        zipfile.close();
      }
    },

    async fetchCompanyConcept(cik: string, taxonomy: string, tag: string): Promise<SecConceptResult | null> {
      const url = `${DATA_BASE_URL}/api/xbrl/companyconcept/CIK${normalizeCik(cik)}/${taxonomy}/${tag}.json`;
      const raw = await withRetry(() => requestJson(url), retryOptions);
      if (raw === null) return null; // 404(E11) — 재시도 없이 폴백 신호
      return raw as SecConceptResult;
    },

    async fetchSubmissions(cik: string): Promise<SecSubmissionsEntry | null> {
      const url = `${DATA_BASE_URL}/submissions/CIK${normalizeCik(cik)}.json`;
      const raw = await withRetry(() => requestJson(url), retryOptions);
      if (raw === null) return null;
      const parsed = parseSubmissionsResponse(raw);
      if (!parsed.ok) {
        throw new SecRequestError(200, `submissions 응답 검증 실패: ${parsed.error}`);
      }
      return toSecSubmissionsEntry(parsed.data);
    },
  };
}

function extractCikFromFileName(fileName: string): string {
  const match = /CIK(\d{10})/.exec(fileName);
  return match ? match[1]! : fileName;
}

function openZip(zipPath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("failed to open zip"));
        return;
      }
      resolve(zipfile);
    });
  });
}

interface ZipEntryResult {
  fileName: string;
  content?: string;
  error?: string;
}

/** 중앙 디렉터리 순회 — cikSet에 매칭되는 엔트리만 스트림을 열어 읽는다(전체 압축 해제 없음). */
async function* iterateZipEntries(
  zipfile: yauzl.ZipFile,
  cikSet: Set<string>,
): AsyncGenerator<ZipEntryResult> {
  const queue: ZipEntryResult[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;
  let fatalError: Error | null = null;

  zipfile.on("entry", (entry: yauzl.Entry) => {
    const cik = extractCikFromFileName(entry.fileName);
    if (!cikSet.has(cik)) {
      zipfile.readEntry();
      return;
    }
    zipfile.openReadStream(entry, (streamErr, readStream) => {
      if (streamErr || !readStream) {
        queue.push({ fileName: entry.fileName, error: streamErr?.message ?? "stream open failed" });
        resolveNext?.();
        zipfile.readEntry();
        return;
      }
      const chunks: Buffer[] = [];
      readStream.on("data", (data: Buffer) => chunks.push(data));
      readStream.on("end", () => {
        queue.push({ fileName: entry.fileName, content: Buffer.concat(chunks).toString("utf-8") });
        resolveNext?.();
        zipfile.readEntry();
      });
      readStream.on("error", (streamReadErr) => {
        queue.push({ fileName: entry.fileName, error: streamReadErr.message });
        resolveNext?.();
        zipfile.readEntry();
      });
    });
  });

  zipfile.on("end", () => {
    done = true;
    resolveNext?.();
  });

  zipfile.on("error", (err) => {
    fatalError = err;
    done = true;
    resolveNext?.();
  });

  zipfile.readEntry();

  while (!done || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
      resolveNext = null;
      continue;
    }
    const next = queue.shift()!;
    yield next;
  }

  if (fatalError) throw fatalError;
}
