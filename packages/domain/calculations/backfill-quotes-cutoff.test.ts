import { describe, it, expect } from "vitest";
import { computeQuotesBackfillCutoff } from "./backfill-quotes-cutoff";

describe("computeQuotesBackfillCutoff", () => {
  it("12개월 전 같은 날짜를 반환한다(1년 룩백)", () => {
    expect(computeQuotesBackfillCutoff(new Date("2026-07-09T00:00:00Z"), 12)).toBe("2025-07-09");
  });

  it("연 경계를 넘어간다", () => {
    expect(computeQuotesBackfillCutoff(new Date("2026-02-15T00:00:00Z"), 12)).toBe("2025-02-15");
    expect(computeQuotesBackfillCutoff(new Date("2026-01-31T12:00:00Z"), 3)).toBe("2025-10-31");
  });

  it("대상 월에 해당 일자가 없으면 말일로 보정한다", () => {
    // 3/31의 1개월 전 = 2월(2026은 28일) → 2/28
    expect(computeQuotesBackfillCutoff(new Date("2026-03-31T00:00:00Z"), 1)).toBe("2026-02-28");
    // 윤년: 2024/2는 29일
    expect(computeQuotesBackfillCutoff(new Date("2024-03-31T00:00:00Z"), 1)).toBe("2024-02-29");
  });

  it("시각 성분은 무시하고 날짜만 반영한다(UTC)", () => {
    expect(computeQuotesBackfillCutoff(new Date("2026-07-09T23:59:59Z"), 12)).toBe("2025-07-09");
  });
});
