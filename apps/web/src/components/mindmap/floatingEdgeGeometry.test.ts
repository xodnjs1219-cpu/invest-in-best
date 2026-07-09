import { Position, type InternalNode, type Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { getFloatingEdgeParams } from "@/components/mindmap/floatingEdgeGeometry";

/** 100x40 크기 노드를 지정 좌표에 만든다(measured + positionAbsolute). */
const node = (x: number, y: number): InternalNode<Node> =>
  ({
    measured: { width: 100, height: 40 },
    internals: { positionAbsolute: { x, y } },
  }) as unknown as InternalNode<Node>;

describe("getFloatingEdgeParams", () => {
  it("좌우 배치(target이 오른쪽) → source는 우변, target은 좌변에서 연결", () => {
    const source = node(0, 0);
    const target = node(300, 0); // 오른쪽에 위치
    const { sourcePos, targetPos } = getFloatingEdgeParams(source, target);
    expect(sourcePos).toBe(Position.Right);
    expect(targetPos).toBe(Position.Left);
  });

  it("좌우 배치(target이 왼쪽) → source는 좌변, target은 우변에서 연결", () => {
    const source = node(300, 0);
    const target = node(0, 0); // 왼쪽에 위치
    const { sourcePos, targetPos } = getFloatingEdgeParams(source, target);
    expect(sourcePos).toBe(Position.Left);
    expect(targetPos).toBe(Position.Right);
  });

  it("상하 배치(target이 아래) → source는 하변, target은 상변에서 연결", () => {
    const source = node(0, 0);
    const target = node(0, 300); // 아래에 위치
    const { sourcePos, targetPos } = getFloatingEdgeParams(source, target);
    expect(sourcePos).toBe(Position.Bottom);
    expect(targetPos).toBe(Position.Top);
  });

  it("교점 좌표는 노드 경계 범위 안에 있다", () => {
    const source = node(0, 0);
    const target = node(300, 0);
    const { sx, sy } = getFloatingEdgeParams(source, target);
    // source 노드(0~100, 0~40) 경계 내
    expect(sx).toBeGreaterThanOrEqual(0);
    expect(sx).toBeLessThanOrEqual(100);
    expect(sy).toBeGreaterThanOrEqual(0);
    expect(sy).toBeLessThanOrEqual(40);
  });
});
