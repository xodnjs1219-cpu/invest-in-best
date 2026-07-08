import { describe, expect, it } from "vitest";
import { getTimelineToday } from "./timeline";

describe("getTimelineToday", () => {
  it("UTC 자정 직후에도 Asia/Seoul 기준 날짜(다음날)를 반환한다", () => {
    // Arrange: UTC 2026-07-08T00:30:00Z → Asia/Seoul(UTC+9) 2026-07-08T09:30:00
    const utcMidnight = new Date("2026-07-08T00:30:00Z");

    // Act
    const result = getTimelineToday(utcMidnight);

    // Assert
    expect(result).toBe("2026-07-08");
  });

  it("UTC 저녁 시각은 Asia/Seoul 기준 다음날로 넘어간다", () => {
    // Arrange: UTC 2026-07-08T16:00:00Z → Asia/Seoul 2026-07-09T01:00:00
    const utcEvening = new Date("2026-07-08T16:00:00Z");

    // Act
    const result = getTimelineToday(utcEvening);

    // Assert
    expect(result).toBe("2026-07-09");
  });

  it("인자를 생략하면 현재 시각 기준으로 계산한다", () => {
    // Act
    const result = getTimelineToday();

    // Assert
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
