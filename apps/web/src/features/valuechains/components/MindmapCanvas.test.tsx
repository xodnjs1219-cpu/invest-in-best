// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MindmapCanvas } from "@/features/valuechains/components/MindmapCanvas";
import {
  useChainViewActions,
  useChainViewState,
} from "@/features/valuechains/context/chain-view-context";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

vi.mock("@/features/valuechains/context/chain-view-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/valuechains/context/chain-view-context")
  >("@/features/valuechains/context/chain-view-context");
  return { ...actual, useChainViewState: vi.fn(), useChainViewActions: vi.fn() };
});

const mockActions = () => {
  const actions = {
    commitNodeDrag: vi.fn(),
    toggleGroupCollapse: vi.fn(),
    retryStructure: vi.fn(),
  };
  vi.mocked(useChainViewActions).mockReturnValue(actions);
  return actions;
};

describe("MindmapCanvas", () => {
  it("structure.status='loading'이면 스켈레톤을 표시한다", () => {
    // Arrange
    vi.mocked(useChainViewState).mockReturnValue({
      structure: { status: "loading" },
      renderGraph: null,
    } as never);
    mockActions();

    // Act
    render(<MindmapCanvas />);

    // Assert
    expect(screen.getByTestId("mindmap-skeleton")).toBeInTheDocument();
  });

  it("structure.status='not-found'이면 ChainNotFoundFallback을 표시한다", () => {
    // Arrange
    vi.mocked(useChainViewState).mockReturnValue({
      structure: { status: "not-found" },
      renderGraph: null,
    } as never);
    mockActions();

    // Act
    render(<MindmapCanvas />);

    // Assert
    expect(screen.getByText("체인을 찾을 수 없습니다.")).toBeInTheDocument();
  });

  it("structure.status='error'이면 StructureErrorFallback을 표시한다", () => {
    // Arrange
    vi.mocked(useChainViewState).mockReturnValue({
      structure: { status: "error" },
      renderGraph: null,
    } as never);
    mockActions();

    // Act
    render(<MindmapCanvas />);

    // Assert
    expect(screen.getByText("구조 데이터를 불러오지 못했습니다.")).toBeInTheDocument();
  });

  it("structure.status='ready'이면 React Flow 캔버스를 렌더링한다", () => {
    // Arrange
    vi.mocked(useChainViewState).mockReturnValue({
      structure: { status: "ready", data: {}, snapshotEffectiveAt: "", isRestoring: false },
      renderGraph: {
        nodes: [
          {
            id: "n1",
            kind: "listed_company",
            label: "삼성전자",
            sublabel: "005930",
            market: "KRX",
            listingStatus: "listed",
            groupId: null,
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        groups: [],
      },
    } as never);
    mockActions();

    // Act
    const { container } = render(<MindmapCanvas />);

    // Assert
    expect(container.querySelector(".react-flow")).toBeInTheDocument();
  });
});
