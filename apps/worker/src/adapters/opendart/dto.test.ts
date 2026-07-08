import { describe, expect, it } from "vitest";
import {
  parseAmount,
  parseCorpCodeXml,
  parseDartEnvelope,
  toKrxAccountSetFromMultiAcnt,
  toKrxCompanyProfile,
  toKrxStockTotal,
  toNormalizedKrxDisclosure,
} from "./dto";

describe("parseAmount", () => {
  it('converts "1,234,567" to 1234567', () => {
    expect(parseAmount("1,234,567")).toBe(1234567);
  });

  it('converts "-" and "" to null', () => {
    expect(parseAmount("-")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("handles negative comma-formatted values", () => {
    expect(parseAmount("-1,000")).toBe(-1000);
  });
});

describe("parseDartEnvelope", () => {
  it("classifies status:013 as no-data (not an error)", () => {
    const result = parseDartEnvelope({ status: "013", message: "조회된 데이터가 없습니다." });
    expect(result.kind).toBe("no_data");
  });

  it("classifies status:000 as ok", () => {
    const result = parseDartEnvelope({ status: "000", message: "정상", list: [] });
    expect(result.kind).toBe("ok");
  });

  it("classifies status:020 as quota_exceeded", () => {
    const result = parseDartEnvelope({ status: "020", message: "요청 제한 초과" });
    expect(result.kind).toBe("quota_exceeded");
  });

  it("classifies status:011 as auth_error", () => {
    const result = parseDartEnvelope({ status: "011", message: "사용할 수 없는 키" });
    expect(result.kind).toBe("auth_error");
  });

  it("classifies status:800 as maintenance", () => {
    const result = parseDartEnvelope({ status: "800", message: "시스템 점검 중" });
    expect(result.kind).toBe("maintenance");
  });

  it("classifies status:021 as too_many_companies", () => {
    const result = parseDartEnvelope({ status: "021", message: "조회 가능 회사 초과" });
    expect(result.kind).toBe("too_many_companies");
  });

  it("classifies unknown status codes as request_error", () => {
    const result = parseDartEnvelope({ status: "999", message: "기타 오류" });
    expect(result.kind).toBe("request_error");
  });
});

describe("parseCorpCodeXml", () => {
  it("parses CORPCODE.xml and filters out unlisted companies (empty stock_code)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<result>
  <list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><corp_eng_name>Samsung Electronics</corp_eng_name><stock_code>005930</stock_code><modify_date>20260101</modify_date></list>
  <list><corp_code>00999999</corp_code><corp_name>비상장법인</corp_name><corp_eng_name></corp_eng_name><stock_code></stock_code><modify_date>20260102</modify_date></list>
</result>`;
    const result = parseCorpCodeXml(xml);
    expect(result).toEqual([
      { corpCode: "00126380", stockCode: "005930", corpName: "삼성전자", modifyDate: "20260101" },
    ]);
  });
});

describe("toNormalizedKrxDisclosure", () => {
  it("converts a list.json row into the normalized model with a DART viewer URL", () => {
    const row = {
      rcept_no: "20260101000001",
      stock_code: "005930",
      corp_code: "00126380",
      report_nm: "사업보고서",
      rcept_dt: "20260101",
    };
    expect(toNormalizedKrxDisclosure(row)).toEqual({
      rceptNo: "20260101000001",
      stockCode: "005930",
      corpCode: "00126380",
      title: "사업보고서",
      disclosureDate: "2026-01-01",
      url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260101000001",
    });
  });
});

describe("toKrxAccountSetFromMultiAcnt", () => {
  it("maps account_nm '매출액' to revenue and '영업이익' to operating_income", () => {
    const rows = [
      { corp_code: "00126380", sj_div: "IS", account_nm: "매출액", thstrm_amount: "1,000", thstrm_add_amount: "3,000" },
      { corp_code: "00126380", sj_div: "IS", account_nm: "영업이익", thstrm_amount: "100", thstrm_add_amount: "300" },
      { corp_code: "00126380", sj_div: "IS", account_nm: "당기순이익", thstrm_amount: "80", thstrm_add_amount: "240" },
    ];
    const result = toKrxAccountSetFromMultiAcnt("00126380", 2025, "11013", "CFS", rows);
    expect(result.metrics.revenue).toEqual({ threeMonth: 1000, cumulative: 3000 });
    expect(result.metrics.operatingIncome).toEqual({ threeMonth: 100, cumulative: 300 });
    expect(result.metrics.netIncome).toEqual({ threeMonth: 80, cumulative: 240 });
  });

  it("excludes sj_div='BS' rows from the income mapping", () => {
    const rows = [
      { corp_code: "00126380", sj_div: "BS", account_nm: "매출액", thstrm_amount: "999", thstrm_add_amount: "999" },
    ];
    const result = toKrxAccountSetFromMultiAcnt("00126380", 2025, "11013", "CFS", rows);
    expect(result.metrics.revenue).toBeUndefined();
  });
});

describe("toKrxStockTotal", () => {
  it("selects only the se='합계' row and ignores per-class rows (avoids double counting)", () => {
    const rows = [
      { corp_code: "00126380", se: "보통주", istc_totqy: "100", stlm_dt: "20251231" },
      { corp_code: "00126380", se: "우선주", istc_totqy: "10", stlm_dt: "20251231" },
      { corp_code: "00126380", se: "합계", istc_totqy: "110", stlm_dt: "20251231" },
    ];
    const result = toKrxStockTotal("00126380", rows);
    expect(result).toEqual({ corpCode: "00126380", totalShares: 110, settlementDate: "2025-12-31" });
  });

  it("returns null when no '합계' row exists", () => {
    const rows = [{ corp_code: "00126380", se: "보통주", istc_totqy: "100", stlm_dt: "20251231" }];
    expect(toKrxStockTotal("00126380", rows)).toBeNull();
  });
});

describe("toKrxCompanyProfile", () => {
  it("maps company.json fields to the normalized profile model", () => {
    const raw = {
      corp_code: "00126380",
      ceo_nm: "홍길동",
      est_dt: "19690113",
      hm_url: "www.samsung.com",
      induty_code: "264",
      adres: "경기도 수원시",
      phn_no: "02-1234-5678",
    };
    expect(toKrxCompanyProfile(raw)).toEqual({
      corpCode: "00126380",
      representativeName: "홍길동",
      establishedDate: "1969-01-13",
      homepageUrl: "www.samsung.com",
      sector: null,
      industryCode: "264",
      address: "경기도 수원시",
      phone: "02-1234-5678",
    });
  });
});
