import type { XYPosition } from "@iib/domain";

/**
 * 그룹 레이아웃 헬퍼 (UC-017 plan 모듈 M9) — 전부 순수 함수.
 * 그룹 좌표는 DB에 영속되지 않는 파생값(database.md §3.3 — 그룹 좌표 컬럼 없음)이므로
 * 항상 멤버 노드의 절대 좌표에서 계산한다. 절대(문서 상태·스냅샷 영속 좌표)↔상대
 * (React Flow 자식 좌표) 변환은 이 파일이 유일한 지점이다(렌더 M8과 드래그 환원 M13이 공유 — DRY).
 */

export const GROUP_PADDING = 24;
export const GROUP_HEADER_HEIGHT = 32;
export const NODE_DEFAULT_WIDTH = 160;
export const NODE_DEFAULT_HEIGHT = 60;
export const EMPTY_GROUP_SIZE = { width: 200, height: 120 } as const;
export const EMPTY_GROUP_FALLBACK_ORIGIN: XYPosition = { x: 0, y: 0 };
export const EMPTY_GROUP_FALLBACK_OFFSET = 40;

export interface GroupBounds {
  position: XYPosition;
  width: number;
  height: number;
}

/** bounds 계산에서 가정할 노드 치수/패딩 — 미지정 시 카드형(box) 기본값. */
export interface GroupBoundsOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  padding?: number;
}

/**
 * 뷰어 원형(circle) 모드 bounds 옵션 — 노드 프레젠터의 92px 원(`h-[92px]`)과 짝.
 * 그룹이 rounded-full(타원)로 렌더되어 모서리가 깎이므로 패딩을 넉넉히 줘
 * 경계가 멤버 원을 자르지 않게 한다.
 */
export const CIRCLE_NODE_BOUNDS: GroupBoundsOptions = {
  nodeWidth: 92,
  nodeHeight: 92,
  padding: 36,
};

/**
 * 멤버 절대 좌표들의 bounding box + 패딩·헤더 여백을 계산한다.
 * 멤버 0개(빈 그룹)는 EMPTY_GROUP_SIZE와 인덱스 기반 스택 폴백 위치를 반환한다
 * (결정적 — 그룹 좌표는 비영속이므로 파생 배치. 빈 그룹 전환 시 위치가 폴백으로
 * 이동하는 것은 알려진 MVP 제약).
 * `options`로 노드 치수를 표시 모양에 맞출 수 있다(뷰어 원형 모드 — 렌더·드래그 환원이
 * 반드시 같은 옵션을 써야 좌표가 튀지 않는다).
 */
export function computeGroupBounds(
  memberPositions: XYPosition[],
  index: number,
  options?: GroupBoundsOptions,
): GroupBounds {
  if (memberPositions.length === 0) {
    return {
      position: {
        x: EMPTY_GROUP_FALLBACK_ORIGIN.x + index * EMPTY_GROUP_FALLBACK_OFFSET,
        y: EMPTY_GROUP_FALLBACK_ORIGIN.y + index * EMPTY_GROUP_FALLBACK_OFFSET,
      },
      width: EMPTY_GROUP_SIZE.width,
      height: EMPTY_GROUP_SIZE.height,
    };
  }

  const nodeWidth = options?.nodeWidth ?? NODE_DEFAULT_WIDTH;
  const nodeHeight = options?.nodeHeight ?? NODE_DEFAULT_HEIGHT;
  const padding = options?.padding ?? GROUP_PADDING;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pos of memberPositions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  }

  return {
    position: { x: minX - padding, y: minY - padding - GROUP_HEADER_HEIGHT },
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2 + GROUP_HEADER_HEIGHT,
  };
}

/** 절대 좌표(문서 상태) → React Flow 자식 상대 좌표. */
export function toRelativePosition(absolute: XYPosition, groupPosition: XYPosition): XYPosition {
  return { x: absolute.x - groupPosition.x, y: absolute.y - groupPosition.y };
}

/** React Flow 자식 상대 좌표 → 절대 좌표(문서 상태·스냅샷 영속). */
export function toAbsolutePosition(relative: XYPosition, groupPosition: XYPosition): XYPosition {
  return { x: relative.x + groupPosition.x, y: relative.y + groupPosition.y };
}
