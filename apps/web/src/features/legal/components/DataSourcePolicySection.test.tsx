// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DATA_SOURCE_LABELS, DATA_SOURCE_POLICY_TEXT } from "@iib/domain";
import { DataSourcePolicySection } from "./DataSourcePolicySection";

describe("DataSourcePolicySection", () => {
  it("출처 3종(DART/SEC EDGAR/토스증권)을 전부 표시한다(BR-7)", () => {
    render(<DataSourcePolicySection />);
    for (const label of DATA_SOURCE_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("DATA_SOURCE_POLICY_TEXT 상수 문구를 그대로 표시한다(하드코딩 없음)", () => {
    render(<DataSourcePolicySection />);
    expect(screen.getByText(DATA_SOURCE_POLICY_TEXT)).toBeInTheDocument();
  });
});
