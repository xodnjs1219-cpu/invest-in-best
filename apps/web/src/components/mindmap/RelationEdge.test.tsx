// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelationEdge, type RelationEdgeType } from "@/components/mindmap/RelationEdge";

const baseEdgeMock = vi.hoisted(() => vi.fn());

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return {
    ...actual,
    getBezierPath: () => ["M0,0 L100,100", 50, 50],
    BaseEdge: (props: { markerEnd?: string; path: string }) => {
      baseEdgeMock(props);
      return <path className="react-flow__edge-path" d={props.path} markerEnd={props.markerEnd} />;
    },
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const buildProps = (data: RelationEdgeType["data"]): Parameters<typeof RelationEdge>[0] =>
  ({
    id: "e1",
    source: "n1",
    target: "n2",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "bottom",
    targetPosition: "top",
    data,
  }) as unknown as Parameters<typeof RelationEdge>[0];

describe("RelationEdge", () => {
  it("유향 관계 엣지 — 라벨 + target 방향 화살표(markerEnd)", () => {
    // Arrange & Act
    render(<RelationEdge {...buildProps({ label: "공급", isDirected: true })} />);

    // Assert
    expect(screen.getByText("공급")).toBeInTheDocument();
    expect(baseEdgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ markerEnd: expect.stringContaining("arrow") }),
    );
  });

  it("무향 관계 엣지 — 라벨 표시, 화살표 없음", () => {
    // Arrange & Act
    render(<RelationEdge {...buildProps({ label: "경쟁", isDirected: false })} />);

    // Assert
    expect(screen.getByText("경쟁")).toBeInTheDocument();
    expect(baseEdgeMock).toHaveBeenCalledWith(expect.objectContaining({ markerEnd: undefined }));
  });

  it("isHighlighted=true — 오류 하이라이트 스타일 적용(422 위치 표시)", () => {
    // Arrange & Act
    render(<RelationEdge {...buildProps({ label: "공급", isDirected: true, isHighlighted: true })} />);

    // Assert
    expect(baseEdgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ style: expect.objectContaining({ stroke: expect.any(String) }) }),
    );
  });

  it("isInactiveType=true — 비활성 시각 구분 스타일(점선) 적용", () => {
    // Arrange & Act
    render(<RelationEdge {...buildProps({ label: "구관계", isDirected: true, isInactiveType: true })} />);

    // Assert
    expect(baseEdgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ style: expect.objectContaining({ strokeDasharray: expect.any(String) }) }),
    );
  });
});
