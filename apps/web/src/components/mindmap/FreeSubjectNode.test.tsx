// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { FreeSubjectNode, type FreeSubjectNodeType } from "@/components/mindmap/FreeSubjectNode";

const buildProps = (
  overrides: Partial<FreeSubjectNodeType["data"]> = {},
): Parameters<typeof FreeSubjectNode>[0] =>
  ({
    id: "n2",
    data: { label: "소비자", subjectType: "consumer", ...overrides },
    selected: false,
    dragging: false,
    type: "freeSubjectNode",
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  }) as unknown as Parameters<typeof FreeSubjectNode>[0];

const renderNode = (props: Parameters<typeof FreeSubjectNode>[0]) =>
  render(
    <ReactFlowProvider>
      <FreeSubjectNode {...props} />
    </ReactFlowProvider>,
  );

describe("FreeSubjectNode", () => {
  it("자유 주체 노드(consumer) — 이름 + 소비자 유형 뱃지", () => {
    // Arrange & Act
    renderNode(buildProps({ label: "최종 소비자층" }));

    // Assert
    expect(screen.getByText("최종 소비자층")).toBeInTheDocument();
    expect(screen.getByText("소비자")).toBeInTheDocument();
  });

  it("정부/기관 유형 뱃지를 표시한다", () => {
    // Arrange & Act
    renderNode(buildProps({ label: "산업통상자원부", subjectType: "government" }));

    // Assert
    expect(screen.getByText("산업통상자원부")).toBeInTheDocument();
    expect(screen.getByText("정부/기관")).toBeInTheDocument();
  });
});
