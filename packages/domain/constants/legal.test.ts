import { describe, expect, it } from "vitest";
import { LEGAL_DOCS, REQUIRED_TERMS_DOC_TYPES } from "./legal";

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
