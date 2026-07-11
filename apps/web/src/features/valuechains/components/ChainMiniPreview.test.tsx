// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildMiniPreviewLayout,
  ChainMiniPreview,
} from "@/features/valuechains/components/ChainMiniPreview";

describe("buildMiniPreviewLayout (시드 기반 결정적 레이아웃)", () => {
  it("같은 chainId·nodeCount면 항상 같은 레이아웃을 반환한다(결정성)", () => {
    const a = buildMiniPreviewLayout("chain-1", 12);
    const b = buildMiniPreviewLayout("chain-1", 12);
    expect(a).toEqual(b);
  });

  it("다른 chainId면 다른 배치가 나온다(시드 분리)", () => {
    const a = buildMiniPreviewLayout("chain-1", 6);
    const b = buildMiniPreviewLayout("chain-2", 6);
    expect(a.nodes).not.toEqual(b.nodes);
  });

  it("점 개수는 nodeCount를 3~9로 클램프해 반영한다", () => {
    expect(buildMiniPreviewLayout("c", 0).nodes).toHaveLength(3);
    expect(buildMiniPreviewLayout("c", 6).nodes).toHaveLength(6);
    expect(buildMiniPreviewLayout("c", 100).nodes).toHaveLength(9);
  });

  it("모든 좌표는 뷰박스(96×64) 안에 있고 인접 열 연결 엣지가 존재한다", () => {
    const { nodes, edges } = buildMiniPreviewLayout("chain-x", 9);
    for (const node of nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(96);
      expect(node.y).toBeGreaterThanOrEqual(8);
      expect(node.y).toBeLessThanOrEqual(56);
    }
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.to.column).toBe((edge.from.column + 1) as 1 | 2);
    }
  });
});

describe("ChainMiniPreview", () => {
  it("장식 썸네일을 렌더한다(aria-hidden, 포인터 이벤트 없음)", () => {
    render(<ChainMiniPreview chainId="chain-1" nodeCount={5} />);
    const preview = screen.getByTestId("chain-mini-preview");
    expect(preview).toHaveAttribute("aria-hidden", "true");
    expect(preview.querySelectorAll("circle")).toHaveLength(5);
  });
});
