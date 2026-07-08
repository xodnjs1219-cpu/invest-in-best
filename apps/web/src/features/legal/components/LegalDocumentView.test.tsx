// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LegalDocContent } from "@iib/domain";
import { LegalDocumentView } from "./LegalDocumentView";

const doc: LegalDocContent = {
  docType: "terms_of_service",
  title: "이용약관",
  body: "첫 번째 문단입니다.\n\n두 번째 문단입니다.",
  version: "v1.0",
  effectiveDate: "2026-07-01",
};

describe("LegalDocumentView", () => {
  it("제목을 렌더링한다", () => {
    render(<LegalDocumentView doc={doc} />);
    expect(screen.getByRole("heading", { name: "이용약관" })).toBeInTheDocument();
  });

  it("버전·시행일을 표기한다(MVP 표기 의무)", () => {
    render(<LegalDocumentView doc={doc} />);
    expect(screen.getByText(/버전 v1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/2026-07-01/)).toBeInTheDocument();
  });

  it("본문을 빈 줄 기준 문단(<p>)으로 분리 렌더링한다", () => {
    render(<LegalDocumentView doc={doc} />);
    expect(screen.getByText("첫 번째 문단입니다.")).toBeInTheDocument();
    expect(screen.getByText("두 번째 문단입니다.")).toBeInTheDocument();
  });

  it("children 미전달 시 추가 섹션이 없다", () => {
    const { container } = render(<LegalDocumentView doc={doc} />);
    expect(container.querySelector("[data-testid='legal-doc-extra']")).not.toBeInTheDocument();
  });

  it("children 전달 시 본문 아래 추가 섹션을 표시한다", () => {
    render(
      <LegalDocumentView doc={doc}>
        <div data-testid="legal-doc-extra">추가 섹션</div>
      </LegalDocumentView>,
    );
    expect(screen.getByTestId("legal-doc-extra")).toBeInTheDocument();
  });
});
