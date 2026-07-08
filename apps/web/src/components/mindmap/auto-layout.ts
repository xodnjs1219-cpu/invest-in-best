import type { NodePosition } from "@iib/domain";
import type { RenderGroup, RenderNode } from "@/components/mindmap/types";

/**
 * 자동 레이아웃 상수 (plan 모듈 A8) — 그룹별 컬럼 구획 + 그룹 내 그리드, 미소속은 별도 우측 구획(E6).
 * 간격·셀 크기는 결정적 배치를 위해 여기서 고정한다.
 */
const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 140;
const GRID_ROWS_PER_COLUMN = 4;
const UNASSIGNED_GROUP_KEY = "__unassigned__";

/**
 * 좌표 없는 노드만 배치하는 순수 함수(E11). 그룹별로 컬럼 구획을 나누어, 같은 그룹의 노드는
 * 항상 동일한 x(구획) 안에서 세로로 쌓이고(그리드 한계 도달 시에만 다음 x로 넘어감), 미소속
 * 노드는 별도 우측 구획에 배치된다(E6). 입력이 같으면 항상 같은 출력(결정적)이며 입력을 변이하지 않는다.
 */
export const applyAutoLayout = (
  nodes: readonly RenderNode[],
  groups: readonly RenderGroup[],
): Record<string, NodePosition> => {
  const result: Record<string, NodePosition> = {};

  // 구획 순서: groups 배열 순서 그대로 + 마지막에 미소속 구획.
  const columnKeys = [...groups.map((group) => group.id), UNASSIGNED_GROUP_KEY];
  const columnBaseIndex = new Map<string, number>(columnKeys.map((key, index) => [key, index]));

  // 그룹(미소속 포함)별로 좌표 미지정 노드만 순서대로 모은다.
  const pendingByColumn = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.position !== null) {
      continue;
    }
    const columnKey = node.groupId ?? UNASSIGNED_GROUP_KEY;
    const list = pendingByColumn.get(columnKey) ?? [];
    list.push(node.id);
    pendingByColumn.set(columnKey, list);
  }

  for (const [columnKey, nodeIds] of pendingByColumn) {
    const baseIndex = columnBaseIndex.get(columnKey) ?? columnKeys.length;

    nodeIds.forEach((nodeId, order) => {
      // 같은 구획 안에서는 세로로 쌓되, 그리드 한계(GRID_ROWS_PER_COLUMN)를 넘으면
      // 다음 서브컬럼으로 넘어간다(과밀 방지). 동일 그룹 내에서는 항상 같은 x 대역을 공유한다.
      const subColumn = Math.floor(order / GRID_ROWS_PER_COLUMN);
      const row = order % GRID_ROWS_PER_COLUMN;
      result[nodeId] = {
        x: (baseIndex + subColumn * columnKeys.length) * COLUMN_WIDTH,
        y: row * ROW_HEIGHT,
      };
    });
  }

  return result;
};
