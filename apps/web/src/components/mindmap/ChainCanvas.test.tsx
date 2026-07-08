// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { ChainCanvas } from "@/components/mindmap/ChainCanvas";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("ChainCanvas", () => {
  it("nodes/edges가 빈 배열이면 빈 상태 오버레이를 표시한다", () => {
    render(<ChainCanvas nodes={[]} edges={[]} />);
    expect(screen.getByText("노드를 추가해 밸류체인을 구성하세요")).toBeInTheDocument();
  });

  it("props 없이도 기본값(빈 배열)으로 렌더링된다", () => {
    render(<ChainCanvas />);
    expect(screen.getByText("노드를 추가해 밸류체인을 구성하세요")).toBeInTheDocument();
  });

  it("nodes가 있으면 빈 상태 오버레이를 표시하지 않는다", () => {
    render(
      <ChainCanvas
        nodes={[{ id: "n1", position: { x: 0, y: 0 }, data: {} }]}
        edges={[]}
      />,
    );
    expect(screen.queryByText("노드를 추가해 밸류체인을 구성하세요")).not.toBeInTheDocument();
  });
});
