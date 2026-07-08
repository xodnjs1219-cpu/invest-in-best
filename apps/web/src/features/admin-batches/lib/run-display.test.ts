import { describe, expect, it } from "vitest";
import {
  formatBackfillProgress,
  formatElapsed,
  formatKstDateTime,
  formatRunDuration,
} from "@/features/admin-batches/lib/run-display";

describe("formatElapsed", () => {
  it("83분 경과 시 1시간 23분을 포함한다", () => {
    const startedAt = "2026-07-05T00:00:00.000Z";
    const now = new Date("2026-07-05T01:23:00.000Z");

    expect(formatElapsed(startedAt, now)).toContain("1시간 23분");
  });

  it("30초 경과(분 미만)는 분 단위 표기 없이 초 단위로 표시한다", () => {
    const startedAt = "2026-07-05T00:00:00.000Z";
    const now = new Date("2026-07-05T00:00:30.000Z");

    const result = formatElapsed(startedAt, now);
    expect(result).not.toContain("분");
    expect(result).toContain("초");
  });
});

describe("formatRunDuration", () => {
  it("02:00:00 → 02:41:12은 41분 12초를 반환한다", () => {
    const started = "2026-07-05T02:00:00.000Z";
    const finished = "2026-07-05T02:41:12.000Z";

    expect(formatRunDuration(started, finished)).toBe("41분 12초");
  });
});

describe("formatBackfillProgress", () => {
  it("(2710, 3200) → percent 85, 라벨 2,710 / 3,200", () => {
    const result = formatBackfillProgress(2710, 3200);

    expect(result.percent).toBe(85);
    expect(result.label).toBe("2,710 / 3,200");
  });

  it("(0, 0) → percent 0, 미실행 라벨(E11)", () => {
    const result = formatBackfillProgress(0, 0);

    expect(result.percent).toBe(0);
    expect(result.label).toBe("0 / 0");
  });

  it("(3200, 3200) → percent 100", () => {
    const result = formatBackfillProgress(3200, 3200);

    expect(result.percent).toBe(100);
  });
});

describe("formatKstDateTime", () => {
  it("UTC 입력을 KST(UTC+9) 표기로 변환한다", () => {
    const result = formatKstDateTime("2026-07-05T00:00:00.000Z");

    // KST = UTC+9 → 09:00
    expect(result).toContain("09:00");
  });
});
