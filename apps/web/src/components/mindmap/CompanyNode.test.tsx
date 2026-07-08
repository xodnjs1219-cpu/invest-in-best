// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { CompanyNode, type CompanyNodeType } from "@/components/mindmap/CompanyNode";

const buildProps = (
  overrides: Partial<CompanyNodeType["data"]> = {},
): Parameters<typeof CompanyNode>[0] =>
  ({
    id: "n1",
    data: {
      label: "삼성전자",
      sublabel: "005930",
      market: "KRX",
      listingStatus: "listed",
      ...overrides,
    },
    selected: false,
    dragging: false,
    type: "companyNode",
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  }) as unknown as Parameters<typeof CompanyNode>[0];

const renderNode = (props: Parameters<typeof CompanyNode>[0]) =>
  render(
    <ReactFlowProvider>
      <CompanyNode {...props} />
    </ReactFlowProvider>,
  );

describe("CompanyNode", () => {
  it("상장기업 노드(listed) 렌더 — 티커·종목명·시장 배지 표시, 상태 배지 없음", () => {
    // Arrange & Act
    renderNode(buildProps());

    // Assert
    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(screen.getByText("005930")).toBeInTheDocument();
    expect(screen.getByText("KRX")).toBeInTheDocument();
    expect(screen.queryByText("상장폐지")).not.toBeInTheDocument();
    expect(screen.queryByText("거래정지")).not.toBeInTheDocument();
  });

  it("상장폐지(delisted) 종목 노드 — 상태 배지 표시, 노드 자체는 정상 렌더 (E10)", () => {
    // Arrange & Act
    renderNode(buildProps({ listingStatus: "delisted" }));

    // Assert
    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(screen.getByText("상장폐지")).toBeInTheDocument();
  });

  it("거래정지(suspended) 종목 노드 — 상태 배지 표시", () => {
    // Arrange & Act
    renderNode(buildProps({ listingStatus: "suspended" }));

    // Assert
    expect(screen.getByText("거래정지")).toBeInTheDocument();
  });
});
