// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NodeAddPanel } from "@/features/valuechains/editor/components/NodeAddPanel";

vi.mock("@/features/valuechains/editor/components/SecuritySearchTab", () => ({
  SecuritySearchTab: ({ disabled }: { disabled: boolean }) => (
    <div data-testid="security-search-tab" data-disabled={String(disabled)} />
  ),
}));

vi.mock("@/features/valuechains/editor/components/FreeSubjectFormTab", () => ({
  FreeSubjectFormTab: ({ disabled }: { disabled: boolean }) => (
    <div data-testid="free-subject-form-tab" data-disabled={String(disabled)} />
  ),
}));

describe("NodeAddPanel", () => {
  it("노드 89개 이하 → 잔여 안내 미표시, 두 탭 정상 활성", () => {
    render(
      <NodeAddPanel
        nodeCount={50}
        isNearNodeLimit={false}
        remainingNodeCapacity={50}
        onAddListedCompanyNode={vi.fn()}
        onAddFreeSubjectNode={vi.fn()}
        usedSecurityIds={new Set()}
        nodeListItems={[]}
        groupNameById={new Map()}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(screen.queryByText(/잔여/)).not.toBeInTheDocument();
    expect(screen.getByTestId("security-search-tab")).toHaveAttribute("data-disabled", "false");
  });

  it("노드 90개(근접) → 잔여 안내 배지 표시", () => {
    render(
      <NodeAddPanel
        nodeCount={90}
        isNearNodeLimit
        remainingNodeCapacity={10}
        onAddListedCompanyNode={vi.fn()}
        onAddFreeSubjectNode={vi.fn()}
        usedSecurityIds={new Set()}
        nodeListItems={[]}
        groupNameById={new Map()}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(screen.getByText(/잔여 10개/)).toBeInTheDocument();
  });

  it("노드 100개(상한) → 상한 안내 배너 + 종목 검색 탭 입력 비활성(E1)", () => {
    render(
      <NodeAddPanel
        nodeCount={100}
        isNearNodeLimit
        remainingNodeCapacity={0}
        onAddListedCompanyNode={vi.fn()}
        onAddFreeSubjectNode={vi.fn()}
        usedSecurityIds={new Set()}
        nodeListItems={[]}
        groupNameById={new Map()}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(screen.getByText(/상한/)).toBeInTheDocument();
    expect(screen.getByTestId("security-search-tab")).toHaveAttribute("data-disabled", "true");
  });

  it("노드 100개(상한) 상태에서 자유 주체 탭 전환 시에도 입력 비활성(E1)", async () => {
    const user = userEvent.setup();
    render(
      <NodeAddPanel
        nodeCount={100}
        isNearNodeLimit
        remainingNodeCapacity={0}
        onAddListedCompanyNode={vi.fn()}
        onAddFreeSubjectNode={vi.fn()}
        usedSecurityIds={new Set()}
        nodeListItems={[]}
        groupNameById={new Map()}
        onDeleteNode={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "자유 주체" }));
    expect(screen.getByTestId("free-subject-form-tab")).toHaveAttribute("data-disabled", "true");
  });

  it("탭 전환이 가능하다", async () => {
    const user = userEvent.setup();
    render(
      <NodeAddPanel
        nodeCount={0}
        isNearNodeLimit={false}
        remainingNodeCapacity={100}
        onAddListedCompanyNode={vi.fn()}
        onAddFreeSubjectNode={vi.fn()}
        usedSecurityIds={new Set()}
        nodeListItems={[]}
        groupNameById={new Map()}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(screen.getByTestId("security-search-tab")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "자유 주체" }));
    expect(screen.getByTestId("free-subject-form-tab")).toBeInTheDocument();
  });

  it("groupPanel 슬롯이 있으면 '그룹' 탭이 생기고, 전환 시 슬롯을 렌더한다", async () => {
    const user = userEvent.setup();
    render(
      <NodeAddPanel
        nodeCount={0}
        isNearNodeLimit={false}
        remainingNodeCapacity={100}
        onAddListedCompanyNode={vi.fn()}
        onAddFreeSubjectNode={vi.fn()}
        usedSecurityIds={new Set()}
        nodeListItems={[]}
        groupNameById={new Map()}
        onDeleteNode={vi.fn()}
        groupCount={2}
        groupPanel={<div data-testid="group-panel-slot" />}
      />,
    );

    const groupTab = screen.getByRole("tab", { name: /그룹/ });
    expect(groupTab).toHaveTextContent("(2)");
    await user.click(groupTab);
    expect(screen.getByTestId("group-panel-slot")).toBeInTheDocument();
  });

  it("groupPanel 미전달이면 '그룹' 탭 자체가 없다(하위호환)", () => {
    render(
      <NodeAddPanel
        nodeCount={0}
        isNearNodeLimit={false}
        remainingNodeCapacity={100}
        onAddListedCompanyNode={vi.fn()}
        onAddFreeSubjectNode={vi.fn()}
        usedSecurityIds={new Set()}
        nodeListItems={[]}
        groupNameById={new Map()}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(screen.queryByRole("tab", { name: /그룹/ })).not.toBeInTheDocument();
  });
});
