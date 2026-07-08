import { describe, expect, it } from "vitest";
import {
  computeGroupBounds,
  toAbsolutePosition,
  toRelativePosition,
  GROUP_PADDING,
  NODE_DEFAULT_WIDTH,
  NODE_DEFAULT_HEIGHT,
  EMPTY_GROUP_SIZE,
} from "./groupLayout";

describe("computeGroupBounds", () => {
  it("멤버 2개 좌표 → min-패딩 위치, 크기 = 범위 + 2×패딩 + 헤더", () => {
    const bounds = computeGroupBounds([{ x: 0, y: 0 }, { x: 100, y: 50 }], 0);
    expect(bounds.position.x).toBe(0 - GROUP_PADDING);
    expect(bounds.position.y).toBeLessThan(0);
    expect(bounds.width).toBeGreaterThan(100);
    expect(bounds.height).toBeGreaterThan(50);
  });

  it("멤버 1개 → 노드 추정 크기 기준 유한 bbox(0 크기 아님)", () => {
    const bounds = computeGroupBounds([{ x: 10, y: 10 }], 0);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(Number.isFinite(bounds.width)).toBe(true);
    expect(Number.isFinite(bounds.height)).toBe(true);
  });

  it("빈 그룹(index 0/1) → 폴백 크기 + 스택 오프셋(서로 겹치지 않음), 결정적", () => {
    const first = computeGroupBounds([], 0);
    const second = computeGroupBounds([], 1);
    expect(first.width).toBe(EMPTY_GROUP_SIZE.width);
    expect(first.height).toBe(EMPTY_GROUP_SIZE.height);
    expect(second.position).not.toEqual(first.position);

    // 결정적: 동일 입력 → 동일 출력
    const firstAgain = computeGroupBounds([], 0);
    expect(firstAgain).toEqual(first);
  });

  it("NaN/Infinity 미발생(유한값 보장)", () => {
    const bounds = computeGroupBounds([{ x: -50, y: -50 }, { x: 200, y: 300 }], 3);
    expect(Number.isFinite(bounds.position.x)).toBe(true);
    expect(Number.isFinite(bounds.position.y)).toBe(true);
    expect(Number.isFinite(bounds.width)).toBe(true);
    expect(Number.isFinite(bounds.height)).toBe(true);
  });

  it("노드 추정 크기 상수가 유한하다", () => {
    expect(Number.isFinite(NODE_DEFAULT_WIDTH)).toBe(true);
    expect(Number.isFinite(NODE_DEFAULT_HEIGHT)).toBe(true);
  });
});

describe("좌표 변환(절대↔상대) 왕복 항등", () => {
  it("정수 좌표 왕복", () => {
    const absolute = { x: 120, y: 80 };
    const groupPosition = { x: 20, y: 10 };
    const relative = toRelativePosition(absolute, groupPosition);
    const roundTrip = toAbsolutePosition(relative, groupPosition);
    expect(roundTrip).toEqual(absolute);
  });

  it("음수 좌표 왕복", () => {
    const absolute = { x: -50, y: -30 };
    const groupPosition = { x: -10, y: 5 };
    const relative = toRelativePosition(absolute, groupPosition);
    const roundTrip = toAbsolutePosition(relative, groupPosition);
    expect(roundTrip).toEqual(absolute);
  });

  it("소수 좌표 왕복", () => {
    const absolute = { x: 12.5, y: 33.25 };
    const groupPosition = { x: 1.1, y: 2.2 };
    const relative = toRelativePosition(absolute, groupPosition);
    const roundTrip = toAbsolutePosition(relative, groupPosition);
    expect(roundTrip.x).toBeCloseTo(absolute.x);
    expect(roundTrip.y).toBeCloseTo(absolute.y);
  });
});
