// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DATA_SOURCE_LABELS, INVESTMENT_DISCLAIMER_DOC } from "@iib/domain";
import DisclaimerPage, { metadata } from "./page";

describe("app/(public)/legal/disclaimer/page.tsx", () => {
  it("면책 전문 + 버전·시행일을 렌더링한다(200 상당)", () => {
    render(<DisclaimerPage />);
    expect(
      screen.getByRole("heading", { name: INVESTMENT_DISCLAIMER_DOC.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(INVESTMENT_DISCLAIMER_DOC.version))).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(INVESTMENT_DISCLAIMER_DOC.effectiveDate)),
    ).toBeInTheDocument();
  });

  it("데이터 출처 표기 정책 섹션 + 출처 3종을 표시한다(BR-7)", () => {
    render(<DisclaimerPage />);
    expect(screen.getByText("데이터 출처 표기 정책")).toBeInTheDocument();
    for (const label of DATA_SOURCE_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("탭 타이틀 메타데이터가 문서 제목을 반영한다", () => {
    expect(metadata.title).toBe(INVESTMENT_DISCLAIMER_DOC.title);
  });
});
