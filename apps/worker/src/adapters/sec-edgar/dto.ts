/**
 * SEC EDGAR 외부 DTO 스키마 (docs/usecases/027/plan.md 모듈 9).
 * 필수 최소 필드만 엄격 검증 + passthrough. columnar(filings.recent) → 행 배열 변환 유틸 포함.
 */
import { z } from "zod";
import type { SecSubmissionsEntry, SecTickerEntry } from "./contract";

/** CIK 정규화 — 10자리 zero-pad, 문자열 유지(앞자리 0 유실 방지). */
export function normalizeCik(input: string | number): string {
  const digits = String(input).replace(/\D/g, "");
  return digits.padStart(10, "0");
}

const addressSchema = z
  .object({
    street1: z.string().nullable().optional(),
    street2: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    stateOrCountry: z.string().nullable().optional(),
    zipCode: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  })
  .passthrough();

const columnarFilingsSchema = z
  .object({
    accessionNumber: z.array(z.string()),
    form: z.array(z.string()),
    filingDate: z.array(z.string()),
    primaryDocument: z.array(z.string()),
  })
  .passthrough()
  .refine(
    (v) =>
      v.accessionNumber.length === v.form.length &&
      v.form.length === v.filingDate.length &&
      v.filingDate.length === v.primaryDocument.length,
    { message: "filings.recent 컬럼형 배열 길이가 일치하지 않습니다" },
  );

export const submissionsResponseSchema = z
  .object({
    cik: z.string().min(1),
    name: z.string().min(1),
    sic: z.string().nullable().optional(),
    sicDescription: z.string().nullable().optional(),
    stateOfIncorporationDescription: z.string().nullable().optional(),
    addresses: z
      .object({ business: addressSchema.nullable().optional() })
      .passthrough()
      .nullable()
      .optional(),
    phone: z.string().nullable().optional(),
    fiscalYearEnd: z.string().nullable().optional(),
    filings: z.object({ recent: columnarFilingsSchema }).passthrough(),
  })
  .passthrough();

export type SubmissionsResponse = z.infer<typeof submissionsResponseSchema>;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function parseSubmissionsResponse(raw: unknown): ParseResult<SubmissionsResponse> {
  const result = submissionsResponseSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data };
}

export function toSecSubmissionsEntry(dto: SubmissionsResponse): SecSubmissionsEntry {
  const recent = dto.filings.recent;
  const recentFilings = recent.accessionNumber.map((accessionNumber, i) => ({
    accessionNumber,
    form: recent.form[i]!,
    filingDate: recent.filingDate[i]!,
    primaryDocument: recent.primaryDocument[i]!,
  }));

  const business = dto.addresses?.business;

  return {
    cik: normalizeCik(dto.cik),
    name: dto.name,
    sic: dto.sic ?? null,
    sicDescription: dto.sicDescription ?? null,
    stateOfIncorporationDescription: dto.stateOfIncorporationDescription ?? null,
    businessAddress: business
      ? {
          street1: business.street1 ?? null,
          city: business.city ?? null,
          stateOrCountry: business.stateOrCountry ?? null,
          zipCode: business.zipCode ?? null,
        }
      : null,
    phone: dto.phone ?? null,
    fiscalYearEnd: dto.fiscalYearEnd ?? null,
    recentFilings,
  };
}

export const companyFactsResponseSchema = z
  .object({
    facts: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export type CompanyFactsResponse = z.infer<typeof companyFactsResponseSchema>;

export function parseCompanyFactsResponse(raw: unknown): ParseResult<CompanyFactsResponse> {
  const result = companyFactsResponseSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data };
}

/** company_tickers.json — {"0": {cik_str, ticker, title}, "1": {...}, ...} 인덱스 키 객체 맵(UC-031 Phase 0). */
const tickerEntrySchema = z
  .object({
    cik_str: z.coerce.number(),
    ticker: z.string().min(1),
    title: z.string().min(1),
  })
  .passthrough();

export const tickerCikMapResponseSchema = z.record(z.string(), tickerEntrySchema);
export type TickerCikMapResponse = z.infer<typeof tickerCikMapResponseSchema>;

export function parseTickerCikMapResponse(raw: unknown): ParseResult<TickerCikMapResponse> {
  const result = tickerCikMapResponseSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data };
}

/**
 * 인덱스 키 객체 맵 → 내부 모델 배열(CIK 10자리 zero-pad 정규화).
 * company_tickers.json은 한 회사(동일 CIK)가 여러 클래스 티커(BRK-A/BRK-B 등)로 중복 등장한다.
 * securities.cik 는 유니크 제약(uq_securities_cik)이므로 CIK당 1행(대표=최초 등장 티커)으로 dedup한다.
 * — dedup하지 않으면 한 UPSERT 청크 내 동일 CIK 충돌로 청크 전체가 실패한다(관측된 US 종목 누락 원인).
 */
export function toSecTickerEntries(dto: TickerCikMapResponse): SecTickerEntry[] {
  const byCik = new Map<string, SecTickerEntry>();
  for (const entry of Object.values(dto)) {
    const cik = normalizeCik(entry.cik_str);
    if (byCik.has(cik)) continue; // 최초 등장 티커를 대표로 유지
    byCik.set(cik, { cik, ticker: entry.ticker, title: entry.title });
  }
  return [...byCik.values()];
}

export const companyConceptResponseSchema = z
  .object({
    units: z.record(z.string(), z.array(z.unknown())),
  })
  .passthrough();

/** SEC 공시 원문 URL 조립: /Archives/edgar/data/{cikNum}/{accessionNoDashless}/{primaryDocument}. */
export function buildFilingUrl(cikNum: string | number, accessionNumber: string, primaryDocument: string): string {
  const cik = String(cikNum).replace(/^0+/, "") || "0";
  const dashless = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${dashless}/${primaryDocument}`;
}
