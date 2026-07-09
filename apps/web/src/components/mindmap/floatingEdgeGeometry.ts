import { Position, type InternalNode, type Node } from "@xyflow/react";

/**
 * Floating edge 기하 계산 (React Flow 공식 floating-edges 예제 이식).
 * 엣지를 고정 핸들이 아니라 "두 노드 중심을 잇는 선이 노드 경계와 만나는 지점"에 붙인다 —
 * 노드가 어디 있든 가장 가까운 변으로 자연스럽게 연결된다.
 */

/** 두 노드 중심을 잇는 선이 `intersectionNode` 경계와 만나는 교점을 구한다. */
function getNodeIntersection(
  intersectionNode: InternalNode<Node>,
  targetNode: InternalNode<Node>,
): { x: number; y: number } {
  const w = (intersectionNode.measured.width ?? 0) / 2;
  const h = (intersectionNode.measured.height ?? 0) / 2;

  const x2 = intersectionNode.internals.positionAbsolute.x + w;
  const y2 = intersectionNode.internals.positionAbsolute.y + h;
  const targetW = (targetNode.measured.width ?? 0) / 2;
  const targetH = (targetNode.measured.height ?? 0) / 2;
  const x1 = targetNode.internals.positionAbsolute.x + targetW;
  const y1 = targetNode.internals.positionAbsolute.y + targetH;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

/** 교점이 노드의 어느 변(상/하/좌/우)에 있는지 판정 — 베지어 곡선 방향 결정용. */
function getEdgePosition(
  node: InternalNode<Node>,
  intersectionPoint: { x: number; y: number },
): Position {
  const nx = Math.round(node.internals.positionAbsolute.x);
  const ny = Math.round(node.internals.positionAbsolute.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + (node.measured.width ?? 0) - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + (node.measured.height ?? 0) - 1) return Position.Bottom;
  return Position.Top;
}

/**
 * 노드의 지정 변(Position) 중앙 좌표를 구한다.
 * 한 변으로 들어오는 엣지가 다수일 때, 그 변의 중앙 한 점으로 접점을 통일하는 데 쓴다(엣지 번들링).
 */
export function getSideCenter(node: InternalNode<Node>, side: Position): { x: number; y: number } {
  const x = node.internals.positionAbsolute.x;
  const y = node.internals.positionAbsolute.y;
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;
  switch (side) {
    case Position.Top:
      return { x: x + w / 2, y };
    case Position.Bottom:
      return { x: x + w / 2, y: y + h };
    case Position.Left:
      return { x, y: y + h / 2 };
    case Position.Right:
    default:
      return { x: x + w, y: y + h / 2 };
  }
}

/** source/target 노드로부터 floating edge의 시작·끝 좌표와 각 변 위치를 계산한다. */
export function getFloatingEdgeParams(
  source: InternalNode<Node>,
  target: InternalNode<Node>,
): {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
} {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos: getEdgePosition(source, sourceIntersectionPoint),
    targetPos: getEdgePosition(target, targetIntersectionPoint),
  };
}
