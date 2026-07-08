/**
 * OpenDART 외부 DTO 스키마 (docs/usecases/027/plan.md 모듈 7).
 * 응답 Zod 스키마 — 외부 계약과 내부 모델(contract.ts)을 분리한다.
 * 필수 최소 필드만 엄격 검증하고 미지 필드는 passthrough(026 모듈 12와 동일 방침).
 */
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { DART_ACCOUNT_MAP } from "@iib/domain";
import type {
  CorpCodeMapping,
  KrxAccountSet,
  KrxCompanyProfile,
  KrxMetricAmount,
  KrxStockTotal,
  NormalizedKrxDisclosure,
} from "./contract";

/** 공통 envelope(status/message) — 모든 OpenDART JSON 응답 공통. */
export const dartEnvelopeSchema = z
  .object({
    status: z.string(),
    message: z.string(),
  })
  .passthrough();

export type DartEnvelopeKind =
  | "ok"
  | "no_data"
  | "quota_exceeded"
  | "too_many_companies"
  | "maintenance"
  | "auth_error"
  | "request_error";

export interface DartEnvelopeResult {
  kind: DartEnvelopeKind;
  status: string;
  message: string;
}

/** 응답 바디 status 필드로 성공/실패 분류(BR-7 — HTTP 코드가 아닌 바디 기준). */
export function parseDartEnvelope(raw: unknown): DartEnvelopeResult {
  const parsed = dartEnvelopeSchema.parse(raw);
  const { status, message } = parsed;
  let kind: DartEnvelopeKind;
  switch (status) {
    case "000":
      kind = "ok";
      break;
    case "013":
      kind = "no_data";
      break;
    case "020":
      kind = "quota_exceeded";
      break;
    case "021":
      kind = "too_many_companies";
      break;
    case "800":
      kind = "maintenance";
      break;
    case "010":
    case "011":
    case "012":
    case "901":
      kind = "auth_error";
      break;
    default:
      kind = "request_error";
  }
  return { kind, status, message };
}

/** "1,234,567" → 1234567, "-"/"" → null. */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-") return null;
  const normalized = trimmed.replace(/,/g, "");
  const value = Number(normalized);
  return Number.isNaN(value) ? null : value;
}

// corp_code/stock_code는 앞자리 0을 보존해야 하므로(예: "005930") 숫자 자동 변환을 끈다.
const xmlParser = new XMLParser({ ignoreAttributes: true, trimValues: true, parseTagValue: false });

/** corpCode.xml(압축 해제된 XML 문자열) → 상장 법인만 매핑(stock_code 공란 제외). */
export function parseCorpCodeXml(xml: string): CorpCodeMapping[] {
  const parsed = xmlParser.parse(xml) as {
    result?: { list?: Array<Record<string, unknown>> | Record<string, unknown> };
  };
  const rawList = parsed.result?.list;
  const list: Array<Record<string, unknown>> = Array.isArray(rawList)
    ? rawList
    : rawList
      ? [rawList]
      : [];

  const mappings: CorpCodeMapping[] = [];
  for (const item of list) {
    const stockCode = String(item.stock_code ?? "").trim();
    if (stockCode === "") continue; // 비상장 법인 제외
    mappings.push({
      corpCode: String(item.corp_code ?? ""),
      stockCode,
      corpName: String(item.corp_name ?? ""),
      modifyDate: String(item.modify_date ?? ""),
    });
  }
  return mappings;
}

/** list.json 응답 행 → 정규화된 공시(DART 뷰어 URL 조립). */
export function toNormalizedKrxDisclosure(row: {
  rcept_no: string;
  stock_code: string;
  corp_code: string;
  report_nm: string;
  rcept_dt: string;
}): NormalizedKrxDisclosure {
  const dt = row.rcept_dt;
  const disclosureDate = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
  return {
    rceptNo: row.rcept_no,
    stockCode: row.stock_code,
    corpCode: row.corp_code,
    title: row.report_nm,
    disclosureDate,
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${row.rcept_no}`,
  };
}

interface DartAccountRow {
  corp_code?: string;
  sj_div: string;
  account_id?: string;
  account_nm: string;
  thstrm_amount?: string;
  thstrm_add_amount?: string;
}

function matchesAccount(
  row: DartAccountRow,
  matchers: Array<{ accountId?: string; accountNm?: string[] }>,
): boolean {
  return matchers.some((m) => {
    if (m.accountId && row.account_id === m.accountId) return true;
    if (m.accountNm && m.accountNm.includes(row.account_nm)) return true;
    return false;
  });
}

/** 다중회사/단일회사 재무제표 손익 행(IS/CIS만) → 지표별 KrxAccountSet. */
export function toKrxAccountSetFromMultiAcnt(
  corpCode: string,
  bsnsYear: number,
  reprtCode: string,
  fsDiv: "CFS" | "OFS",
  rows: DartAccountRow[],
): KrxAccountSet {
  const incomeRows = rows.filter((r) => r.sj_div === "IS" || r.sj_div === "CIS");
  // IS 우선, CIS는 IS 부재 시 폴백.
  const hasIs = incomeRows.some((r) => r.sj_div === "IS");
  const effectiveRows = hasIs ? incomeRows.filter((r) => r.sj_div === "IS") : incomeRows;

  const metrics: KrxAccountSet["metrics"] = {};

  const buildMetric = (matchers: Array<{ accountId?: string; accountNm?: string[] }>): KrxMetricAmount | undefined => {
    const row = effectiveRows.find((r) => matchesAccount(r, matchers));
    if (!row) return undefined;
    return {
      threeMonth: parseAmount(row.thstrm_amount),
      cumulative: parseAmount(row.thstrm_add_amount),
    };
  };

  const revenue = buildMetric(DART_ACCOUNT_MAP.revenue);
  if (revenue) metrics.revenue = revenue;
  const operatingIncome = buildMetric(DART_ACCOUNT_MAP.operatingIncome);
  if (operatingIncome) metrics.operatingIncome = operatingIncome;
  const netIncome = buildMetric(DART_ACCOUNT_MAP.netIncome);
  if (netIncome) metrics.netIncome = netIncome;

  return { corpCode, bsnsYear, reprtCode, fsDiv, metrics };
}

interface DartStockTotalRow {
  corp_code?: string;
  se: string;
  istc_totqy?: string;
  stlm_dt?: string;
}

/** se='합계'(또는 '총계') 행만 채택 — 종류별 행 합산 시 이중 집계 방지. */
export function toKrxStockTotal(corpCode: string, rows: DartStockTotalRow[]): KrxStockTotal | null {
  const totalRow = rows.find((r) => r.se === "합계" || r.se === "총계");
  if (!totalRow) return null;
  const totalShares = parseAmount(totalRow.istc_totqy);
  if (totalShares === null) return null;
  const stlm = totalRow.stlm_dt ?? "";
  const settlementDate = stlm.includes("-") ? stlm : `${stlm.slice(0, 4)}-${stlm.slice(4, 6)}-${stlm.slice(6, 8)}`;
  return { corpCode, totalShares, settlementDate };
}

interface DartCompanyRow {
  corp_code?: string;
  ceo_nm?: string;
  est_dt?: string;
  hm_url?: string;
  sector?: string;
  induty_code?: string;
  adres?: string;
  phn_no?: string;
}

/** company.json → 정형 정보(연도-월-일 변환, 공란은 null). */
export function toKrxCompanyProfile(raw: DartCompanyRow): KrxCompanyProfile {
  const estDt = raw.est_dt ?? "";
  const establishedDate =
    estDt.length === 8 ? `${estDt.slice(0, 4)}-${estDt.slice(4, 6)}-${estDt.slice(6, 8)}` : null;
  return {
    corpCode: raw.corp_code ?? "",
    representativeName: raw.ceo_nm || null,
    establishedDate,
    homepageUrl: raw.hm_url || null,
    sector: raw.sector || null,
    industryCode: raw.induty_code || null,
    address: raw.adres || null,
    phone: raw.phn_no || null,
  };
}
