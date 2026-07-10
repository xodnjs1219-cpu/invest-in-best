// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { GroupNode, type GroupNodeType } from "@/components/mindmap/GroupNode";

const buildProps = (
  overrides: Partial<GroupNodeType["data"]> = {},
): Parameters<typeof GroupNode>[0] =>
  ({
    id: "g1",
    data: {
      label: "소재",
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
    renderNode(buildProps());

    // Assert
    expect(screen.getByText("소재")).toBeInTheDocument();
    expect(screen.queryByText(/노드 3개/)).not.toBeInTheDocument();
  });


  it("빈 그룹(멤버 0) — 라벨만 있는 빈 클러스터 표시 (C-1)", () => {
    // Arrange & Act
    renderNode(buildProps());

    // Assert
    expect(screen.getByText("소재")).toBeInTheDocument();
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
