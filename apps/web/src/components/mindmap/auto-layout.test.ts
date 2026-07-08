import { describe, expect, it } from "vitest";
import { applyAutoLayout } from "@/components/mindmap/auto-layout";
import type { RenderGroup, RenderNode } from "@/components/mindmap/types";

const buildNode = (overrides: Partial<RenderNode> & Pick<RenderNode, "id">): RenderNode => ({
  kind: "free_subject",
  label: overrides.id,
  groupId: null,
  position: { x: 0, y: 0 },
  ...overrides,
});

describe("applyAutoLayout", () => {
  it("좌표가 있는 노드는 건드리지 않고, null 좌표 노드에만 좌표를 부여한다", () => {
    // Arrange
    const nodes = [
      buildNode({ id: "n1", position: { x: 10, y: 20 } }),
      buildNode({ id: "n2", position: null as unknown as { x: number; y: number } }),
    ];
    const groups: RenderGroup[] = [];

    // Act
    const result = applyAutoLayout(nodes, groups);

    // Assert
    expect(result["n1"]).toBeUndefined();
    expect(result["n2"]).toBeDefined();
    expect(typeof result["n2"]?.x).toBe("number");
    expect(typeof result["n2"]?.y).toBe("number");
  });

  it("같은 그룹의 노드들이 같은 구획(동일 x 범위) 안에 배치된다", () => {
    // Arrange
    const nodes = [
      buildNode({ id: "n1", groupId: "g1", position: null as unknown as { x: number; y: number } }),
      buildNode({ id: "n2", groupId: "g1", position: null as unknown as { x: number; y: number } }),
      buildNode({ id: "n3", groupId: "g2", position: null as unknown as { x: number; y: number } }),
    ];
    const groups: RenderGroup[] = [
      { id: "g1", label: "그룹1", isCollapsed: false, memberCount: 2 },
      { id: "g2", label: "그룹2", isCollapsed: false, memberCount: 1 },
    ];

    // Act
    const result = applyAutoLayout(nodes, groups);

    // Assert
    expect(result["n1"]?.x).toBe(result["n2"]?.x);
    expect(result["n3"]?.x).not.toBe(result["n1"]?.x);
  });

  it("미소속 노드는 그룹 구획 밖(별도 구획)에 배치된다 (E6)", () => {
    // Arrange
    const nodes = [
      buildNode({ id: "n1", groupId: "g1", position: null as unknown as { x: number; y: number } }),
      buildNode({ id: "n2", groupId: null, position: null as unknown as { x: number; y: number } }),
    ];
    const groups: RenderGroup[] = [{ id: "g1", label: "그룹1", isCollapsed: false, memberCount: 1 }];

    // Act
    const result = applyAutoLayout(nodes, groups);

    // Assert
    expect(result["n2"]?.x).not.toBe(result["n1"]?.x);
  });

  it("동일 입력을 2회 호출하면 동일 출력이며 입력 배열은 비변이한다", () => {
    // Arrange
    const nodes = [
      buildNode({ id: "n1", groupId: "g1", position: null as unknown as { x: number; y: number } }),
    ];
    const groups: RenderGroup[] = [{ id: "g1", label: "그룹1", isCollapsed: false, memberCount: 1 }];
    const nodesCopy = JSON.parse(JSON.stringify(nodes));

    // Act
    const result1 = applyAutoLayout(nodes, groups);
    const result2 = applyAutoLayout(nodes, groups);

    // Assert
    expect(result1).toEqual(result2);
    expect(nodes).toEqual(nodesCopy);
  });
});
