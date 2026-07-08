import type { XYPosition } from "@iib/domain";

/**
 * 신규 노드 기본 좌표 산출 (UC-015 plan 모듈 16) — 순수 함수.
 * 캔버스 기준점(origin) + 노드 수 기반 캐스케이드 오프셋으로 겹침을 완화한다.
 * 뷰포트 중심 배치 등 고도화는 비범위(YAGNI) — 결정적 계단식 배치만 제공한다.
 */

const DEFAULT_ORIGIN: XYPosition = { x: 0, y: 0 };

/** 계단 오프셋 간격(px). */
const OFFSET_STEP_X = 40;
const OFFSET_STEP_Y = 40;
/** 이 개수마다 다음 열로 줄바꿈(랩어라운드)해 좌표 폭주를 방지한다. */
const WRAP_EVERY_N_NODES = 10;

export function getDefaultNodePosition(existingNodeCount: number, origin: XYPosition = DEFAULT_ORIGIN): XYPosition {
  const column = Math.floor(existingNodeCount / WRAP_EVERY_N_NODES);
  const row = existingNodeCount % WRAP_EVERY_N_NODES;

  return {
    x: origin.x + column * WRAP_EVERY_N_NODES * OFFSET_STEP_X + row * OFFSET_STEP_X,
    y: origin.y + row * OFFSET_STEP_Y,
  };
}
