// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  RelationEdge,
  directedArrowMarker,
  type RelationEdgeType,
} from "@/components/mindmap/RelationEdge";

const baseEdgeMock = vi.hoisted(() => vi.fn());

// floating edge는 useInternalNode로 노드 기하를 읽는다 → 측정된 노드를 반환하도록 mock한다.
const internalNode = (x: number) => ({
  measured: { width: 100, height: 40 },
  internals: { positionAbsolute: { x, y: 0 } },
});

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return {
    ...actual,
    getBezierPath: () => ["M0,0 L100,100", 50, 50],
    useInternalNode: (id: string) => (id === "n1" ? internalNode(0) : internalNode(200)),
    // 번들링 판정용 store — 단일 엣지 시나리오라 같은 변 다중 진입이 없어 bundleToCenter=false.
    useStore: (selector: (s: { edges: unknown[]; nodeLookup: Map<string, unknown> }) => unknown) =>
      selector({ edges: [], nodeLookup: new Map() }),
    BaseEdge: (props: { markerEnd?: string; path: string }) => {
      baseEdgeMock(props);
      return <path className="react-flow__edge-path" d={props.path} markerEnd={props.markerEnd} />;
    },
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const buildProps = (
  data: RelationEdgeType["data"],
  markerEnd?: string,
): Parameters<typeof RelationEdge>[0] =>
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
    markerEnd,
    data,
  }) as unknown as Parameters<typeof RelationEdge>[0];

describe("RelationEdge", () => {
  it("유향 관계 엣지 — 라벨 + 방향 아이콘 + markerEnd를 BaseEdge에 전달", () => {
    // markerEnd는 selector가 생성해 props로 주입 → RelationEdge는 그대로 BaseEdge에 전달한다.
    render(<RelationEdge {...buildProps({ label: "공급", isDirected: true }, "url(#arrow)")} />);

    expect(screen.getByText("공급")).toBeInTheDocument();
    expect(baseEdgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ markerEnd: "url(#arrow)" }),
    );
  });

  it("무향 관계 엣지 — 라벨 표시, markerEnd 없음(undefined 전달)", () => {
    render(<RelationEdge {...buildProps({ label: "경쟁", isDirected: false })} />);

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

  it("onDelete 미주입(뷰 캔버스) — 삭제 버튼 미표시", () => {
    render(<RelationEdge {...buildProps({ label: "공급", isDirected: true })} />);
    expect(screen.queryByRole("button", { name: /관계 삭제/ })).not.toBeInTheDocument();
  });

  it("onDelete 주입(편집 캔버스) — 삭제 버튼 표시 + 클릭 시 onDelete(edgeId) 호출", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<RelationEdge {...buildProps({ label: "공급", isDirected: true, onDelete })} />);

    const btn = screen.getByRole("button", { name: /공급 관계 삭제/ });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(onDelete).toHaveBeenCalledWith("e1");
  });
});

describe("흐름 오버레이 (rest 무채색 원칙)", () => {
  it("rest 상태 유향 엣지에는 흐름 오버레이를 렌더하지 않는다", () => {
    const { container } = render(
      <RelationEdge {...buildProps({ label: "공급", isDirected: true })} />,
    );
    expect(container.querySelector(".mm-edge-flow")).toBeNull();
  });

  it("강조(isEmphasized) 시 흐름 오버레이를 렌더한다", () => {
    const { container } = render(
      <RelationEdge {...buildProps({ label: "공급", isDirected: true, isEmphasized: true })} />,
    );
    expect(container.querySelector(".mm-edge-flow")).not.toBeNull();
  });
});

describe("directedArrowMarker (뷰/편집 공용 화살표 마커)", () => {
  it("유향 → 화살표 마커 반환(accent 색), 무향 → undefined", () => {
    const directed = directedArrowMarker(true);
    expect(directed).toMatchObject({ color: "var(--fg-subtle)", width: 18, height: 18 });
    expect(directedArrowMarker(false)).toBeUndefined();
  });

  it("하이라이트(422) 유향 → danger 색 화살표", () => {
    expect(directedArrowMarker(true, true)).toMatchObject({ color: "var(--danger)" });
  });
});
