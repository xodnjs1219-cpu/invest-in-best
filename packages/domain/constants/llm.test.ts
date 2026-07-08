import { describe, expect, it } from "vitest";
import {
  ANALYZE_DISCLOSURES_DAILY_LLM_CALL_LIMIT,
  DISCLOSURE_CONTENT_MAX_CHARS,
  LLM_CONSECUTIVE_FAILURE_ABORT_THRESHOLD,
  LLM_RATIONALE_MAX_LENGTH,
  LLM_REQUEST_TIMEOUT_MS,
} from "./llm";

describe("llm constants", () => {
  it("ANALYZE_DISCLOSURES_DAILY_LLM_CALL_LIMIT is a positive integer (cost control, BR-8)", () => {
    expect(Number.isInteger(ANALYZE_DISCLOSURES_DAILY_LLM_CALL_LIMIT)).toBe(true);
    expect(ANALYZE_DISCLOSURES_DAILY_LLM_CALL_LIMIT).toBeGreaterThanOrEqual(1);
  });

  it("DISCLOSURE_CONTENT_MAX_CHARS is a positive integer (truncation length, R-3)", () => {
    expect(Number.isInteger(DISCLOSURE_CONTENT_MAX_CHARS)).toBe(true);
    expect(DISCLOSURE_CONTENT_MAX_CHARS).toBeGreaterThan(0);
  });

  it("LLM_REQUEST_TIMEOUT_MS is a positive number", () => {
    expect(LLM_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("LLM_CONSECUTIVE_FAILURE_ABORT_THRESHOLD is a positive integer (R-13 early abort)", () => {
    expect(Number.isInteger(LLM_CONSECUTIVE_FAILURE_ABORT_THRESHOLD)).toBe(true);
    expect(LLM_CONSECUTIVE_FAILURE_ABORT_THRESHOLD).toBeGreaterThan(0);
  });

  it("LLM_RATIONALE_MAX_LENGTH is a positive integer", () => {
    expect(Number.isInteger(LLM_RATIONALE_MAX_LENGTH)).toBe(true);
    expect(LLM_RATIONALE_MAX_LENGTH).toBeGreaterThan(0);
  });
});
