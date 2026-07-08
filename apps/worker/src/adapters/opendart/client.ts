/**
 * OpenDART 어댑터 구현 (docs/usecases/027/plan.md 모듈 8).
 * 【외부 서비스 연동 모듈 — OpenDART Open API】
 * ZIP 다운로드·XML 파싱, 페이지네이션, 100사 청크, CFS→OFS 폴백, status 판별·오류 매핑, 레이트리밋·재시도.
 */
import * as yauzl from "yauzl";
import { DART_MULTI_ACNT_CHUNK_SIZE, DART_PAGE_COUNT, WORKER_HTTP_TIMEOUT_MS } from "@iib/domain";
import type { WorkerConfig } from "../../runtime/config";
import type { RateLimiter } from "../../runtime/rate-limiter";
import { withRetry, type RetryOptions } from "../../runtime/retry";
import {
  DartAuthError,
  DartMaintenanceError,
  DartQuotaExceededError,
  DartRequestError,
  type CorpCodeMapping,
  type FetchDisclosuresResult,
  type FetchMultiAccountsResult,
  type KrxAccountSet,
  type KrxCompanyProfile,
  type KrxStockTotal,
  type OpenDartPort,
} from "./contract";
import {
  parseCorpCodeXml,
  parseDartEnvelope,
  toKrxAccountSetFromMultiAcnt,
  toKrxCompanyProfile,
  toKrxStockTotal,
  toNormalizedKrxDisclosure,
} from "./dto";

const BASE_URL = "https://opendart.fss.or.kr/api";

export interface OpenDartClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const defaultClock: OpenDartClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface CreateOpenDartClientOptions {
  config: WorkerConfig;
  rateLimiter: RateLimiter;
  fetchImpl?: typeof fetch;
  clock?: OpenDartClock;
  retryOptions?: Partial<RetryOptions>;
}

/** 000/013(no_data)만 재시도 없이 통과 — 800은 재시도 대상, 020/010~012/901/021은 즉시 throw(재시도 판정은 shouldRetryDartError). */
function shouldRetryDartError(error: unknown): boolean {
  if (error instanceof DartQuotaExceededError) return false; // E1: 재시도 금지
  if (error instanceof DartAuthError) return false; // 잡 수준 실패
  if (error instanceof DartMaintenanceError) return true; // E19: 재시도 대상
  if (error instanceof DartRequestError) return false; // 021은 어댑터 내부에서 별도 처리
  return true; // 네트워크/5xx 등은 재시도
}

export function createOpenDartClient(options: CreateOpenDartClientOptions): OpenDartPort {
  const { config, rateLimiter } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const clock = options.clock ?? defaultClock;
  const retryOptions: RetryOptions = {
    sleep: clock.sleep.bind(clock),
    shouldRetry: shouldRetryDartError,
    ...options.retryOptions,
  };

  /** 요청 + envelope 판별을 단일 원자 단위로 수행 — withRetry에 이 함수 전체를 넘겨야 800/네트워크 오류가 재시도된다. */
  async function requestEnvelope(
    path: string,
    params: Record<string, string>,
  ): Promise<{ kind: "ok" | "no_data"; raw: unknown }> {
    await rateLimiter.acquire("OPENDART");
    const query = new URLSearchParams({ crtfc_key: config.opendartApiKey, ...params });
    const url = `${BASE_URL}/${path}?${query.toString()}`;
    const response = await fetchImpl(url, {
      method: "GET",
      signal: AbortSignal.timeout(WORKER_HTTP_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new DartRequestError(String(response.status), `HTTP ${response.status}`);
    }
    const raw: unknown = await response.json();
    const envelope = parseDartEnvelope(raw);
    switch (envelope.kind) {
      case "ok":
        return { kind: "ok", raw };
      case "no_data":
        return { kind: "no_data", raw };
      case "quota_exceeded":
        throw new DartQuotaExceededError(envelope.message);
      case "auth_error":
        throw new DartAuthError(envelope.status, envelope.message);
      case "maintenance":
        throw new DartMaintenanceError(envelope.message);
      case "too_many_companies":
        throw new DartRequestError(envelope.status, envelope.message);
      case "request_error":
      default:
        throw new DartRequestError(envelope.status, envelope.message);
    }
  }

  return {
    async fetchCorpCodeMappings(): Promise<CorpCodeMapping[]> {
      return withRetry(async () => {
        await rateLimiter.acquire("OPENDART");
        const url = `${BASE_URL}/corpCode.xml?${new URLSearchParams({ crtfc_key: config.opendartApiKey }).toString()}`;
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(WORKER_HTTP_TIMEOUT_MS) });
        if (!response.ok) {
          throw new DartRequestError(String(response.status), `HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const zipBuffer = Buffer.from(arrayBuffer);
        const xml = await extractCorpCodeXmlFromZip(zipBuffer);
        return parseCorpCodeXml(xml);
      }, retryOptions);
    },

    async fetchDisclosures(bgnDe: string, endDe: string): Promise<FetchDisclosuresResult> {
      const items: FetchDisclosuresResult["items"] = [];
      let pageNo = 1;

      for (;;) {
        const { kind, raw } = await withRetry(
          () =>
            requestEnvelope("list.json", {
              bgn_de: bgnDe,
              end_de: endDe,
              page_no: String(pageNo),
              page_count: String(DART_PAGE_COUNT),
            }),
          retryOptions,
        );
        if (kind === "no_data") break;

        const body = raw as { list?: unknown[]; total_page?: number };
        const list = Array.isArray(body.list) ? body.list : [];
        for (const row of list as Array<{
          rcept_no: string;
          stock_code: string;
          corp_code: string;
          report_nm: string;
          rcept_dt: string;
        }>) {
          if (!row.stock_code || row.stock_code.trim() === "") continue; // 비상장 제외
          items.push(toNormalizedKrxDisclosure(row));
        }
        const totalPage = body.total_page ?? 1;
        if (pageNo >= totalPage) break;
        pageNo += 1;
      }

      return { items };
    },

    async fetchMultiAccounts(
      corpCodes: string[],
      bsnsYear: number,
      reprtCode: string,
    ): Promise<FetchMultiAccountsResult> {
      const accounts: KrxAccountSet[] = [];
      const respondedCorpCodes = new Set<string>();

      async function fetchChunk(chunkCodes: string[]): Promise<void> {
        const result = await withRetry(
          () =>
            requestEnvelope("fnlttMultiAcnt.json", {
              corp_code: chunkCodes.join(","),
              bsns_year: String(bsnsYear),
              reprt_code: reprtCode,
            }),
          { ...retryOptions, retries: 1 }, // 021은 청크 축소로 자체 해결, 그 외는 상위 withRetry 정책
        ).catch(async (error) => {
          if (error instanceof DartRequestError && error.status === "021" && chunkCodes.length > 1) {
            // E18: 청크를 반으로 축소해 재시도.
            const mid = Math.ceil(chunkCodes.length / 2);
            await fetchChunk(chunkCodes.slice(0, mid));
            await fetchChunk(chunkCodes.slice(mid));
            return null;
          }
          throw error;
        });
        if (result === null) return; // 하위 청크가 이미 처리함
        const { kind, raw } = result;
        if (kind === "no_data") return;

        const body = raw as { list?: unknown[] };
        const list = Array.isArray(body.list) ? body.list : [];
        const byCorp = new Map<string, typeof list>();
        for (const row of list as Array<{ corp_code?: string }>) {
          const corp = row.corp_code ?? "";
          const arr = byCorp.get(corp) ?? [];
          arr.push(row as never);
          byCorp.set(corp, arr);
        }
        for (const [corp, rows] of byCorp) {
          respondedCorpCodes.add(corp);
          accounts.push(
            toKrxAccountSetFromMultiAcnt(corp, bsnsYear, reprtCode, "CFS", rows as never),
          );
        }
      }

      const chunks = chunk(corpCodes, DART_MULTI_ACNT_CHUNK_SIZE);
      for (const c of chunks) {
        await fetchChunk(c);
      }

      const missingCorpCodes = corpCodes.filter((c) => !respondedCorpCodes.has(c));
      return { accounts, missingCorpCodes };
    },

    async fetchFullFinancials(
      corpCode: string,
      bsnsYear: number,
      reprtCode: string,
    ): Promise<KrxAccountSet | null> {
      for (const fsDiv of ["CFS", "OFS"] as const) {
        const { kind, raw } = await withRetry(
          () =>
            requestEnvelope("fnlttSinglAcntAll.json", {
              corp_code: corpCode,
              bsns_year: String(bsnsYear),
              reprt_code: reprtCode,
              fs_div: fsDiv,
            }),
          retryOptions,
        );
        if (kind === "no_data") continue; // 폴백: CFS -> OFS
        const body = raw as { list?: unknown[] };
        const list = Array.isArray(body.list) ? body.list : [];
        return toKrxAccountSetFromMultiAcnt(corpCode, bsnsYear, reprtCode, fsDiv, list as never);
      }
      return null; // 양쪽 013 (E4)
    },

    async fetchStockTotal(
      corpCode: string,
      bsnsYear: number,
      reprtCode: string,
    ): Promise<KrxStockTotal | null> {
      const { kind, raw } = await withRetry(
        () =>
          requestEnvelope("stockTotqySttus.json", {
            corp_code: corpCode,
            bsns_year: String(bsnsYear),
            reprt_code: reprtCode,
          }),
        retryOptions,
      );
      if (kind === "no_data") return null;
      const body = raw as { list?: unknown[] };
      const list = Array.isArray(body.list) ? body.list : [];
      return toKrxStockTotal(corpCode, list as never);
    },

    async fetchCompanyProfile(corpCode: string): Promise<KrxCompanyProfile | null> {
      const { kind, raw } = await withRetry(
        () => requestEnvelope("company.json", { corp_code: corpCode }),
        retryOptions,
      );
      if (kind === "no_data") return null;
      return toKrxCompanyProfile(raw as never);
    },
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** ZIP 버퍼에서 CORPCODE.xml 엔트리만 추출한다(yauzl). */
function extractCorpCodeXmlFromZip(zipBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("failed to open corpCode.xml ZIP"));
        return;
      }
      let found = false;
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        if (entry.fileName.toUpperCase() !== "CORPCODE.XML") {
          zipfile.readEntry();
          return;
        }
        found = true;
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr ?? new Error("failed to open CORPCODE.xml stream"));
            return;
          }
          const chunks: Buffer[] = [];
          readStream.on("data", (data: Buffer) => chunks.push(data));
          readStream.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf-8"));
            zipfile.close();
          });
          readStream.on("error", reject);
        });
      });
      zipfile.on("end", () => {
        if (!found) reject(new Error("CORPCODE.xml entry not found in ZIP"));
      });
      zipfile.on("error", reject);
    });
  });
}
