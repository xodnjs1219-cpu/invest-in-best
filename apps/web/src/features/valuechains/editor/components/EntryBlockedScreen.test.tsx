// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntryBlockedScreen } from "@/features/valuechains/editor/components/EntryBlockedScreen";

describe("EntryBlockedScreen", () => {
  it("ownedChainCount=50, max=50 렌더 → 상한 도달 문구와 수치 표시", () => {
    render(<EntryBlockedScreen ownedChainCount={50} maxChainsPerUser={50} />);
    expect(screen.getByText(/50개 중 50개/)).toBeInTheDocument();
    expect(screen.getByText(/상한/)).toBeInTheDocument();
  });

  it("삭제 유도 링크가 메인('/')으로 연결된다", () => {
    render(<EntryBlockedScreen ownedChainCount={50} maxChainsPerUser={50} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/");
  });

  it("편집 액션(노드 추가/저장 등)을 노출하지 않는다", () => {
    render(<EntryBlockedScreen ownedChainCount={50} maxChainsPerUser={50} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
