import { describe, expect, it } from "vitest";
import { LEGAL_ROUTES, ROUTES } from "./routes";

describe("ROUTES (UC-025 R-1 확정 경로)", () => {
  it("terms/privacy/disclaimer가 /legal 하위 경로로 확정된다", () => {
    expect(ROUTES.terms).toBe("/legal/terms");
    expect(ROUTES.privacy).toBe("/legal/privacy");
    expect(ROUTES.disclaimer).toBe("/legal/disclaimer");
  });

  it("home은 루트 경로다", () => {
    expect(ROUTES.home).toBe("/");
  });
});

describe("LEGAL_ROUTES (docType → 경로 파생 맵)", () => {
  it("3개 키 전부에 대해 /legal/{slug} 형태를 반환한다", () => {
    expect(LEGAL_ROUTES.terms_of_service).toBe("/legal/terms");
    expect(LEGAL_ROUTES.privacy_policy).toBe("/legal/privacy");
    expect(LEGAL_ROUTES.investment_disclaimer).toBe("/legal/disclaimer");
  });

  it("ROUTES 값과 정합된다(단일 SOT)", () => {
    expect(LEGAL_ROUTES.terms_of_service).toBe(ROUTES.terms);
    expect(LEGAL_ROUTES.privacy_policy).toBe(ROUTES.privacy);
    expect(LEGAL_ROUTES.investment_disclaimer).toBe(ROUTES.disclaimer);
  });
});
