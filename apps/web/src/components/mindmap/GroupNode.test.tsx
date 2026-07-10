// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GroupNode, type GroupNodeType } from "@/components/mindmap/GroupNode";

const buildProps = (
  overrides: Partial<GroupNodeType["data"]> = {},
): Parameters<typeof GroupNode>[0] =>
  ({
    id: "g1",
    data: {
      label: "소재",
      isCollapsed: false,
      memberCount: 3,
      onToggleCollapse: vi.fn(),
      ...overrides,
    },
    selected: false,
    dragging: false,
    type: "groupNode",
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    width: 300,
    height: 200,
  }) as unknown as Parameters<typeof GroupNode>[0];

const renderNode = (props: Parameters<typeof GroupNode>[0]) =>
  render(
    <ReactFlowProvider>
      <GroupNode {...props} />
    </ReactFlowProvider>,
  );

describe("GroupNode", () => {
  it("펼침 상태 — 배경 클러스터 + 라벨 표시, 멤버 수 요약 없음", () => {
    // Arrange & Act
    renderNode(buildProps({ isCollapsed: false, memberCount: 3 }));

    // Assert
    expect(screen.getByText("소재")).toBeInTheDocument();
    expect(screen.queryByText(/노드 3개/)).not.toBeInTheDocument();
  });

  it("접힘 상태 — 라벨 + '노드 3개' 요약", () => {
    // Arrange & Act
    renderNode(buildProps({ isCollapsed: true, memberCount: 3 }));

    // Assert
    expect(screen.getByText("소재")).toBeInTheDocument();
    expect(screen.getByText(/노드 3개/)).toBeInTheDocument();
  });

  it("빈 그룹(멤버 0) — 라벨만 있는 빈 클러스터 표시 (C-1)", () => {
    // Arrange & Act
    renderNode(buildProps({ isCollapsed: false, memberCount: 0 }));

    // Assert
    expect(screen.getByText("소재")).toBeInTheDocument();
  });

  it("토글 버튼 클릭 시 onToggleCollapse가 호출된다", async () => {
    // Arrange
    const user = userEvent.setup();
    const onToggleCollapse = vi.fn();
    renderNode(buildProps({ onToggleCollapse }));

    // Act
    await user.click(screen.getByRole("button"));

    // Assert
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });
  it("tone은 4색 순환 — tone=5는 data-tone=1로 렌더된다", () => {
    renderNode(buildProps({ tone: 5 }));
    expect(screen.getByTestId("group-node")).toHaveAttribute("data-tone", "1");
  });

  it("tone 미전달 시 data-tone=0 (기본)", () => {
    renderNode(buildProps());
    expect(screen.getByTestId("group-node")).toHaveAttribute("data-tone", "0");
  });

});
