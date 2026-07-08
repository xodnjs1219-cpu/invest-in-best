import { describe, expect, it } from "vitest";
import {
  candlesCheckpointKey,
  computeProgress,
  parsePhase1Cursor,
  phase1InitialCursor,
} from "./checkpoint-plan";

describe("candlesCheckpointKey", () => {
  it("builds the phase1:candles:{securityId} checkpoint key (docs/usecases/031/plan.md module 13)", () => {
    expect(candlesCheckpointKey("sec-1")).toBe("phase1:candles:sec-1");
  });
});

describe("phase1InitialCursor / parsePhase1Cursor", () => {
  it("returns { before: null } as the initial cursor for a fresh security", () => {
    expect(phase1InitialCursor()).toEqual({ before: null });
  });

  it("parses a well-formed stored cursor", () => {
    const parsed = parsePhase1Cursor({ before: "2026-07-01T00:00:00Z" });
    expect(parsed).toEqual({ before: "2026-07-01T00:00:00Z" });
  });

  it("demotes a malformed/corrupted cursor to the initial cursor instead of throwing (resume safety)", () => {
    expect(parsePhase1Cursor({ before: 12345 })).toEqual({ before: null });
    expect(parsePhase1Cursor("not-an-object")).toEqual({ before: null });
    expect(parsePhase1Cursor(null)).toEqual({ before: null });
    expect(parsePhase1Cursor(undefined)).toEqual({ before: null });
  });
});

describe("computeProgress", () => {
  it("computes the completed/total ratio", () => {
    expect(computeProgress({ completed: 3, total: 10 })).toBe(0.3);
  });

  it("returns 1 (fully done) when total is 0 (no work queued yet)", () => {
    expect(computeProgress({ completed: 0, total: 0 })).toBe(1);
  });
});
