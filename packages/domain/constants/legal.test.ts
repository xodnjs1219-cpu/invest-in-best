import { describe, expect, it } from "vitest";
import { DISCLAIMER_SUMMARY_TEXT, LEGAL_DOCS, REQUIRED_TERMS_DOC_TYPES } from "./legal";

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
