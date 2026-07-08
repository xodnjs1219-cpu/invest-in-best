// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorCanvasContainer } from "@/features/valuechains/editor/components/EditorCanvasContainer";

const stateMock = vi.hoisted(() => ({ current: null as unknown }));
const actionsMock = vi.hoisted(() => ({
  addEdge: vi.fn(() => ({ ok: true })),
  changeEdgeRelation: vi.fn(() => ({ ok: true })),
  deleteElements: vi.fn(),
}));

vi.mock("@/features/valuechains/editor/context/ChainEditorContext", () => ({
  useChainEditorState: () => stateMock.current,
  useChainEditorActions: () => actionsMock,
}));

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function setState(overrides: {
  nodes?: Record<string, unknown>;
  edges?: Record<string, unknown>;
  hasActiveRelationTypes?: boolean;
}) {
  stateMock.current = {
    state: {
      nodes: overrides.nodes ?? {},
      edges: overrides.edges ?? {},
      selection: { nodeIds: [], edgeIds: [] },
    },
    computed: {
      hasActiveRelationTypes: overrides.hasActiveRelationTypes ?? true,
      relationTypeById: new Map(),
      activeRelationTypes: [],
    },
  };
}

describe("EditorCanvasContainer", () => {
  it("hasActiveRelationTypes=false → 관계 설정 불가 안내(캔버스 nodesConnectable=false 전파, E6)", () => {
    setState({ hasActiveRelationTypes: false });
    render(<EditorCanvasContainer />);
    expect(screen.getByText(/관계 설정 불가/)).toBeInTheDocument();
  });

  it("노드/엣지가 없으면 빈 상태 안내를 표시한다", () => {
    setState({});
    render(<EditorCanvasContainer />);
    expect(screen.getByText("노드를 추가해 밸류체인을 구성하세요")).toBeInTheDocument();
  });
});
