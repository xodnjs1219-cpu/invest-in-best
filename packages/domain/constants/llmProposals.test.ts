import { describe, expect, it } from "vitest";
import {
  ADMIN_LLM_PROPOSALS_PAGE_SIZE,
  APPLICABILITY_REASONS,
  LLM_PROPOSAL_STATUSES,
  LLM_PROPOSAL_TYPES,
  REJECT_REASON_MAX_LENGTH,
} from "./llmProposals";

describe("LLM_PROPOSAL_TYPES", () => {
  it("relation_add/relation_update/relation_delete 리터럴과 정확히 일치한다", () => {
    expect(LLM_PROPOSAL_TYPES).toEqual(["relation_add", "relation_update", "relation_delete"]);
  });
});

describe("LLM_PROPOSAL_STATUSES", () => {
  it("pending/approved/rejected/invalidated 리터럴과 정확히 일치한다", () => {
    expect(LLM_PROPOSAL_STATUSES).toEqual(["pending", "approved", "rejected", "invalidated"]);
  });
});

describe("APPLICABILITY_REASONS", () => {
  it("5개 사유 리터럴과 정확히 일치한다", () => {
    expect(APPLICABILITY_REASONS).toEqual([
      "NODE_NOT_FOUND",
      "EDGE_NOT_FOUND",
      "EDGE_ALREADY_EXISTS",
      "RELATION_TYPE_INACTIVE",
      "CHAIN_NOT_APPLICABLE",
    ]);
  });
});

describe("ADMIN_LLM_PROPOSALS_PAGE_SIZE", () => {
  it("1 이상의 정수다", () => {
    expect(Number.isInteger(ADMIN_LLM_PROPOSALS_PAGE_SIZE)).toBe(true);
    expect(ADMIN_LLM_PROPOSALS_PAGE_SIZE).toBeGreaterThanOrEqual(1);
  });

  it("20이다 (spec §6.2-(1))", () => {
    expect(ADMIN_LLM_PROPOSALS_PAGE_SIZE).toBe(20);
  });
});

describe("REJECT_REASON_MAX_LENGTH", () => {
  it("500이다 (R-2 계약 검증용)", () => {
    expect(REJECT_REASON_MAX_LENGTH).toBe(500);
  });
});
