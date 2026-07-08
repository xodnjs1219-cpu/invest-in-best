// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ServerIssue } from "@iib/domain";
import { IssuePanel } from "@/features/valuechains/editor/components/IssuePanel";

describe("IssuePanel", () => {
  it("이슈 0건 → 미렌더", () => {
    const { container } = render(<IssuePanel clientIssues={[]} serverIssues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("서버 이슈 1건(엣지 2개) → 사유 + 대상 요소 수 표시", () => {
    const serverIssues: ServerIssue[] = [
      { code: "VALUECHAINS.INVALID_EDGE", message: "엣지 오류", targets: { clientEdgeIds: ["e1", "e2"] } },
    ];
    render(<IssuePanel clientIssues={[]} serverIssues={serverIssues} />);
    expect(screen.getByText("엣지 오류")).toBeInTheDocument();
    expect(screen.getByText(/엣지 2개/)).toBeInTheDocument();
  });

  it("클라이언트 이슈(이름 공백) → 이름 필드 사유 표시", () => {
    const clientIssues: ServerIssue[] = [
      { code: "NAME_REQUIRED", message: "체인 이름을 입력하세요.", targets: { field: "name" } },
    ];
    render(<IssuePanel clientIssues={clientIssues} serverIssues={[]} />);
    expect(screen.getByText("체인 이름을 입력하세요.")).toBeInTheDocument();
  });

  it("클라이언트+서버 이슈 혼재 → 전부 나열", () => {
    const clientIssues: ServerIssue[] = [
      { code: "INVALID_GROUP", message: "그룹 오류", targets: { clientGroupIds: ["g1"] } },
    ];
    const serverIssues: ServerIssue[] = [
      { code: "VALUECHAINS.DUPLICATE_NAME", message: "이름 중복", targets: { field: "name" } },
    ];
    render(<IssuePanel clientIssues={clientIssues} serverIssues={serverIssues} />);
    expect(screen.getByText("그룹 오류")).toBeInTheDocument();
    expect(screen.getByText("이름 중복")).toBeInTheDocument();
  });
});
