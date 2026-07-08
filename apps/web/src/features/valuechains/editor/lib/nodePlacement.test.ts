import { describe, expect, it } from "vitest";
import { getDefaultNodePosition } from "@/features/valuechains/editor/lib/nodePlacement";

describe("getDefaultNodePosition", () => {
  it("count=0 → origin 그대로", () => {
    expect(getDefaultNodePosition(0, { x: 100, y: 100 })).toEqual({ x: 100, y: 100 });
  });

  it("count=1..n → 단조 오프셋(동일 입력 → 동일 출력, 결정적)", () => {
    const first = getDefaultNodePosition(3, { x: 0, y: 0 });
    const second = getDefaultNodePosition(3, { x: 0, y: 0 });
    expect(first).toEqual(second);
    expect(first).not.toEqual(getDefaultNodePosition(0, { x: 0, y: 0 }));
  });

  it("origin 미지정 시 기본 원점 사용", () => {
    const result = getDefaultNodePosition(0);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });

  it("랩어라운드 경계에서도 좌표가 유한값(NaN 없음)", () => {
    for (let count = 0; count < 200; count += 1) {
      const position = getDefaultNodePosition(count);
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
  });
});
