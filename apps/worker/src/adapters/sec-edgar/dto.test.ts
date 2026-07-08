import { describe, expect, it } from "vitest";
import {
  buildFilingUrl,
  normalizeCik,
  parseCompanyFactsResponse,
  parseSubmissionsResponse,
  parseTickerCikMapResponse,
  toSecSubmissionsEntry,
  toSecTickerEntries,
} from "./dto";

describe("normalizeCik", () => {
  it("zero-pads a short numeric CIK to 10 digits", () => {
    expect(normalizeCik("320193")).toBe("0000320193");
  });

  it("is idempotent for an already zero-padded CIK", () => {
    expect(normalizeCik("0000320193")).toBe("0000320193");
  });
});

describe("parseSubmissionsResponse", () => {
  it("converts the columnar filings.recent arrays into row objects", () => {
    const raw = {
      cik: "0000320193",
      name: "Apple Inc.",
      sic: "3571",
      sicDescription: "Electronic Computers",
      stateOfIncorporationDescription: "CA",
      addresses: {
        business: { street1: "ONE APPLE PARK WAY", city: "CUPERTINO", stateOrCountry: "CA", zipCode: "95014" },
      },
      phone: "(408) 996-1010",
      fiscalYearEnd: "0926",
      filings: {
        recent: {
          accessionNumber: ["0000320193-26-000013", "0000320193-26-000014"],
          form: ["10-Q", "8-K"],
          filingDate: ["2026-05-01", "2026-05-15"],
          primaryDocument: ["a.htm", "b.htm"],
        },
      },
    };
    const result = parseSubmissionsResponse(raw);
    expect(result.ok).toBe(true);
  });

  it("fails validation when columnar arrays have mismatched lengths", () => {
    const raw = {
      cik: "0000320193",
      name: "Apple Inc.",
      filings: {
        recent: {
          accessionNumber: ["a", "b"],
          form: ["10-Q"], // mismatched length
          filingDate: ["2026-05-01", "2026-05-15"],
          primaryDocument: ["a.htm", "b.htm"],
        },
      },
    };
    const result = parseSubmissionsResponse(raw);
    expect(result.ok).toBe(false);
  });

  it("accepts fiscalYearEnd: null (20-F foreign filer, Alibaba-style)", () => {
    const raw = {
      cik: "0001577552",
      name: "Alibaba Group",
      fiscalYearEnd: null,
      filings: { recent: { accessionNumber: [], form: [], filingDate: [], primaryDocument: [] } },
    };
    const result = parseSubmissionsResponse(raw);
    expect(result.ok).toBe(true);
  });

  it("accepts a foreign address with null stateOrCountry and populated country (Alibaba-style)", () => {
    const raw = {
      cik: "0001577552",
      name: "Alibaba Group",
      addresses: {
        business: {
          street1: "26/F TOWER ONE",
          city: "CAUSEWAY BAY",
          stateOrCountry: null,
          zipCode: "00000",
          country: "Hong Kong",
        },
      },
      filings: { recent: { accessionNumber: [], form: [], filingDate: [], primaryDocument: [] } },
    };
    const result = parseSubmissionsResponse(raw);
    expect(result.ok).toBe(true);
  });
});

describe("toSecSubmissionsEntry", () => {
  it("normalizes the parsed DTO into the internal model", () => {
    const raw = {
      cik: "0000320193",
      name: "Apple Inc.",
      sic: "3571",
      sicDescription: "Electronic Computers",
      stateOfIncorporationDescription: "CA",
      addresses: {
        business: { street1: "ONE APPLE PARK WAY", city: "CUPERTINO", stateOrCountry: "CA", zipCode: "95014" },
      },
      phone: "(408) 996-1010",
      fiscalYearEnd: "0926",
      filings: {
        recent: {
          accessionNumber: ["0000320193-26-000013"],
          form: ["10-Q"],
          filingDate: ["2026-05-01"],
          primaryDocument: ["a.htm"],
        },
      },
    };
    const parsed = parseSubmissionsResponse(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const entry = toSecSubmissionsEntry(parsed.data);
    expect(entry).toMatchObject({
      cik: "0000320193",
      name: "Apple Inc.",
      sic: "3571",
      fiscalYearEnd: "0926",
      recentFilings: [{ accessionNumber: "0000320193-26-000013", form: "10-Q" }],
    });
  });
});

describe("parseCompanyFactsResponse", () => {
  it("accepts a response with a facts object present", () => {
    const result = parseCompanyFactsResponse({ cik: 320193, entityName: "Apple", facts: { "us-gaap": {} } });
    expect(result.ok).toBe(true);
  });

  it("fails when facts key is missing entirely", () => {
    const result = parseCompanyFactsResponse({ cik: 320193 });
    expect(result.ok).toBe(false);
  });
});

describe("parseTickerCikMapResponse / toSecTickerEntries", () => {
  it("parses the company_tickers.json object-of-index-keys shape (UC-031 Phase 0 US seed)", () => {
    const raw = {
      "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
      "1": { cik_str: 1577552, ticker: "BABA", title: "Alibaba Group Holding Ltd" },
    };
    const result = parseTickerCikMapResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entries = toSecTickerEntries(result.data);
    expect(entries).toEqual([
      { cik: "0000320193", ticker: "AAPL", title: "Apple Inc." },
      { cik: "0001577552", ticker: "BABA", title: "Alibaba Group Holding Ltd" },
    ]);
  });

  it("fails validation when an entry is missing the ticker field", () => {
    const raw = { "0": { cik_str: 320193, title: "Apple Inc." } };
    const result = parseTickerCikMapResponse(raw);
    expect(result.ok).toBe(false);
  });
});

describe("buildFilingUrl", () => {
  it("builds the dashless accession path for a filing document URL", () => {
    expect(buildFilingUrl("320193", "0001652044-26-000018", "R1.htm")).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000165204426000018/R1.htm",
    );
  });
});
