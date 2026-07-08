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

/**
 * 멤버 절대 좌표들의 bounding box + 패딩·헤더 여백을 계산한다.
 * 멤버 0개(빈 그룹)는 EMPTY_GROUP_SIZE와 인덱스 기반 스택 폴백 위치를 반환한다
 * (결정적 — 그룹 좌표는 비영속이므로 파생 배치. 빈 그룹 전환 시 위치가 폴백으로
 * 이동하는 것은 알려진 MVP 제약).
 */
export function computeGroupBounds(memberPositions: XYPosition[], index: number): GroupBounds {
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

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pos of memberPositions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + NODE_DEFAULT_WIDTH);
    maxY = Math.max(maxY, pos.y + NODE_DEFAULT_HEIGHT);
  }

  return {
    position: { x: minX - GROUP_PADDING, y: minY - GROUP_PADDING - GROUP_HEADER_HEIGHT },
    width: maxX - minX + GROUP_PADDING * 2,
    height: maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER_HEIGHT,
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
