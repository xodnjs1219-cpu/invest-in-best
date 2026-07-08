import { describe, expect, it } from "vitest";
import { DATA_SOURCE_LABELS } from "./data-freshness";
import {
  DATA_SOURCE_POLICY_TEXT,
  DISCLAIMER_SUMMARY_TEXT,
  FOOTER_LEGAL_LINK_LABELS,
  INVESTMENT_DISCLAIMER_DOC,
  LEGAL_DOCS,
  LEGAL_PAGE_DOCS,
  LEGAL_PAGE_SLUGS,
  REQUIRED_TERMS_DOC_TYPES,
  getLegalPageDoc,
  type LegalPageDocType,
} from "./legal";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

describe("LEGAL_DOCS (약관 SOT)", () => {
  it("REQUIRED_TERMS_DOC_TYPES가 LEGAL_DOCS의 키와 정확히 일치한다", () => {
    expect([...REQUIRED_TERMS_DOC_TYPES].sort()).toEqual(Object.keys(LEGAL_DOCS).sort());
  });

  it("필수 약관 2종(이용약관·개인정보처리방침)을 포함한다", () => {
    expect(REQUIRED_TERMS_DOC_TYPES).toContain("terms_of_service");
    expect(REQUIRED_TERMS_DOC_TYPES).toContain("privacy_policy");
    expect(REQUIRED_TERMS_DOC_TYPES).toHaveLength(2);
  });

  it("각 문서에 title/body/version/effectiveDate가 정의되어 있다", () => {
    for (const docType of REQUIRED_TERMS_DOC_TYPES) {
      const doc = LEGAL_DOCS[docType];
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.body.length).toBeGreaterThan(0);
      expect(doc.version.length).toBeGreaterThan(0);
      expect(doc.effectiveDate.length).toBeGreaterThan(0);
    }
  });
});

describe("DISCLAIMER_SUMMARY_TEXT (UC-007 푸터 면책 요약, 결정 G-2)", () => {
  it("투자 판단 참고 자료·투자 권유 아님·투자자 본인 책임 문구를 포함한다", () => {
    expect(DISCLAIMER_SUMMARY_TEXT).toContain("투자 판단의 참고 자료");
    expect(DISCLAIMER_SUMMARY_TEXT).toContain("투자 권유가 아닙니다");
    expect(DISCLAIMER_SUMMARY_TEXT).toContain("투자의 책임은 투자자 본인에게 있습니다");
  });
});

describe("LEGAL_PAGE_DOCS (UC-025 정책 페이지 SOT 확장)", () => {
  it("terms_of_service 항목이 LEGAL_DOCS.terms_of_service와 동일 참조다(BR-3/E4)", () => {
    expect(LEGAL_PAGE_DOCS.terms_of_service).toBe(LEGAL_DOCS.terms_of_service);
  });

  it("privacy_policy 항목이 LEGAL_DOCS.privacy_policy와 동일 참조다(BR-3/E4)", () => {
    expect(LEGAL_PAGE_DOCS.privacy_policy).toBe(LEGAL_DOCS.privacy_policy);
  });

  it("키가 정확히 3종이다", () => {
    expect(Object.keys(LEGAL_PAGE_DOCS).sort()).toEqual(
      ["investment_disclaimer", "privacy_policy", "terms_of_service"].sort(),
    );
  });

  it("모든 문서의 effectiveDate가 YYYY-MM-DD 형식이고 title/body/version이 비어있지 않다", () => {
    for (const docType of Object.keys(LEGAL_PAGE_DOCS) as LegalPageDocType[]) {
      const doc = LEGAL_PAGE_DOCS[docType];
      expect(doc.effectiveDate).toMatch(ISO_DATE_PATTERN);
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.body.length).toBeGreaterThan(0);
      expect(doc.version.length).toBeGreaterThan(0);
    }
  });

  it("각 문서의 docType 필드가 자신의 LEGAL_PAGE_DOCS 키와 일치한다", () => {
    for (const docType of Object.keys(LEGAL_PAGE_DOCS) as LegalPageDocType[]) {
      expect(LEGAL_PAGE_DOCS[docType].docType).toBe(docType);
    }
  });
});

describe("REQUIRED_TERMS_DOC_TYPES (BR-4 회귀 방지)", () => {
  it("investment_disclaimer를 포함하지 않는다", () => {
    expect(REQUIRED_TERMS_DOC_TYPES).not.toContain("investment_disclaimer");
  });
});

describe("LEGAL_PAGE_SLUGS", () => {
  it("값 집합이 LEGAL_PAGE_DOCS의 키 집합과 일치한다", () => {
    expect(Object.values(LEGAL_PAGE_SLUGS).sort()).toEqual(Object.keys(LEGAL_PAGE_DOCS).sort());
  });
});

describe("getLegalPageDoc", () => {
  it("investment_disclaimer를 조회하면 INVESTMENT_DISCLAIMER_DOC을 반환한다", () => {
    expect(getLegalPageDoc("investment_disclaimer")).toBe(INVESTMENT_DISCLAIMER_DOC);
  });

  it("terms_of_service를 조회하면 LEGAL_DOCS.terms_of_service를 반환한다", () => {
    expect(getLegalPageDoc("terms_of_service")).toBe(LEGAL_DOCS.terms_of_service);
  });
});

describe("DATA_SOURCE_POLICY_TEXT (BR-7)", () => {
  it("비어 있지 않은 정책 문구다", () => {
    expect(DATA_SOURCE_POLICY_TEXT.length).toBeGreaterThan(0);
  });

  it("DATA_SOURCE_LABELS의 출처 명칭을 그대로 재사용한다(DRY, A-4)", () => {
    for (const label of DATA_SOURCE_LABELS) {
      expect(DATA_SOURCE_POLICY_TEXT).toContain(label);
    }
  });
});

describe("FOOTER_LEGAL_LINK_LABELS", () => {
  it("3종 라벨(이용약관/개인정보처리방침/투자 면책 문구)을 제공한다", () => {
    expect(FOOTER_LEGAL_LINK_LABELS.terms_of_service).toBe("이용약관");
    expect(FOOTER_LEGAL_LINK_LABELS.privacy_policy).toBe("개인정보처리방침");
    expect(FOOTER_LEGAL_LINK_LABELS.investment_disclaimer).toBe("투자 면책 문구");
  });
});

describe("DATA_SOURCE_LABELS 재사용 참고(A-4, UC-009 소유)", () => {
  it("DART/SEC EDGAR/토스증권 3종을 포함한다(BR-7)", () => {
    expect(DATA_SOURCE_LABELS).toContain("금융감독원 DART");
    expect(DATA_SOURCE_LABELS).toContain("SEC EDGAR");
    expect(DATA_SOURCE_LABELS).toContain("토스증권");
  });
});
