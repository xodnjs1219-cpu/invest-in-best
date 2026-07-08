import { APPLICABILITY_REASONS, LLM_PROPOSAL_STATUSES, LLM_PROPOSAL_TYPES } from "@iib/domain";
import { describe, expect, it } from "vitest";
import {
  APPLICABILITY_REASON_LABELS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_TYPE_LABELS,
} from "@/features/admin-llm-proposals/constants";

describe("PROPOSAL_STATUS_LABELS", () => {
  it("LLM_PROPOSAL_STATUSES 전체를 빠짐없이 커버한다", () => {
    for (const status of LLM_PROPOSAL_STATUSES) {
      expect(PROPOSAL_STATUS_LABELS[status]).toBeTypeOf("string");
      expect(PROPOSAL_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});

describe("PROPOSAL_TYPE_LABELS", () => {
  it("LLM_PROPOSAL_TYPES 전체를 빠짐없이 커버한다", () => {
    for (const type of LLM_PROPOSAL_TYPES) {
      expect(PROPOSAL_TYPE_LABELS[type]).toBeTypeOf("string");
      expect(PROPOSAL_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });
});

describe("APPLICABILITY_REASON_LABELS", () => {
  it("APPLICABILITY_REASONS 전체를 빠짐없이 커버한다", () => {
    for (const reason of APPLICABILITY_REASONS) {
      expect(APPLICABILITY_REASON_LABELS[reason]).toBeTypeOf("string");
      expect(APPLICABILITY_REASON_LABELS[reason].length).toBeGreaterThan(0);
    }
  });
});
