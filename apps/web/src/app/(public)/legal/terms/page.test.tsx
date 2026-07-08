// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCS } from "@iib/domain";
import TermsPage, { metadata } from "./page";

describe("app/(public)/legal/terms/page.tsx", () => {
  it("이용약관 본문 + 버전·시행일을 렌더링한다(200 상당)", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { name: LEGAL_DOCS.terms_of_service.title })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(LEGAL_DOCS.terms_of_service.version))).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(LEGAL_DOCS.terms_of_service.effectiveDate)),
    ).toBeInTheDocument();
  });

  it("출처 표기 섹션은 표시하지 않는다(면책 페이지 전용)", () => {
    render(<TermsPage />);
    expect(screen.queryByText("데이터 출처 표기 정책")).not.toBeInTheDocument();
  });

  it("탭 타이틀 메타데이터가 문서 제목을 반영한다", () => {
    expect(metadata.title).toBe(LEGAL_DOCS.terms_of_service.title);
  });
});
