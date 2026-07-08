// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "@/features/valuechains/editor/components/EditorToolbar";

const stateMock = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/features/valuechains/editor/context/ChainEditorContext", () => ({
  useChainEditorState: () => stateMock.current,
}));

function setState(overrides: {
  name?: string;
  isDirty?: boolean;
  nodeCount?: number;
}) {
  stateMock.current = {
    state: { name: overrides.name ?? "", isDirty: overrides.isDirty ?? false },
    computed: { nodeCount: overrides.nodeCount ?? 0 },
  };
}

describe("EditorToolbar", () => {
  it("진입 직후 → '제목 없음' 플레이스홀더 + 0/100 배지, 더티 표시 없음", () => {
    setState({});
    render(<EditorToolbar />);
    expect(screen.getByText("제목 없음")).toBeInTheDocument();
    expect(screen.getByText("0/100")).toBeInTheDocument();
    expect(screen.queryByTestId("dirty-indicator")).not.toBeInTheDocument();
  });

  it("이름이 있으면 이름을 표시하고, 더티면 더티 표시(●)가 나타난다", () => {
    setState({ name: "AI 반도체", isDirty: true, nodeCount: 3 });
    render(<EditorToolbar />);
    expect(screen.getByText("AI 반도체")).toBeInTheDocument();
    expect(screen.getByText("3/100")).toBeInTheDocument();
    expect(screen.getByTestId("dirty-indicator")).toBeInTheDocument();
  });

  it("저장 버튼은 비활성화되어 있다(UC-018 전까지)", () => {
    setState({});
    render(<EditorToolbar />);
    const saveButton = screen.getByRole("button", { name: /저장/ });
    expect(saveButton).toBeDisabled();
  });
});
