import { describe, expect, it } from "vitest";
import { REJECT_REASON_MAX_LENGTH } from "@iib/domain";
import {
  ProposalIdParamSchema,
  ProposalListQuerySchema,
  ProposalListRpcRowSchema,
  ProposalRejectRequestSchema,
} from "@/features/admin-llm-proposals/backend/schema";

describe("ProposalListQuerySchema", () => {
  it("status/page 미지정 시 기본값(pending, 1)을 적용한다", () => {
    const parsed = ProposalListQuerySchema.parse({});
    expect(parsed).toEqual({ status: "pending", page: 1 });
  });

  it("유효한 status/page를 파싱한다", () => {
    const parsed = ProposalListQuerySchema.parse({ status: "approved", page: "3" });
    expect(parsed).toEqual({ status: "approved", page: 3 });
  });

  it("잘못된 status 값은 파싱에 실패한다", () => {
    const result = ProposalListQuerySchema.safeParse({ status: "banana" });
    expect(result.success).toBe(false);
  });

  it("page=0은 파싱에 실패한다(1 이상 요구)", () => {
    const result = ProposalListQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("page=abc(숫자 아님)는 파싱에 실패한다", () => {
    const result = ProposalListQuerySchema.safeParse({ page: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("ProposalIdParamSchema", () => {
  it("유효한 UUID를 통과시킨다", () => {
    const result = ProposalIdParamSchema.safeParse("11111111-1111-4111-8111-111111111111");
    expect(result.success).toBe(true);
  });

  it("UUID 형식이 아니면 실패한다", () => {
    const result = ProposalIdParamSchema.safeParse("not-a-uuid");
    expect(result.success).toBe(false);
  });
});

describe("ProposalRejectRequestSchema", () => {
  it("reason 미지정 시 통과한다", () => {
    const result = ProposalRejectRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("빈 문자열 reason은 통과한다", () => {
    const result = ProposalRejectRequestSchema.safeParse({ reason: "" });
    expect(result.success).toBe(true);
  });

  it(`reason이 ${REJECT_REASON_MAX_LENGTH + 1}자면 실패한다`, () => {
    const result = ProposalRejectRequestSchema.safeParse({
      reason: "a".repeat(REJECT_REASON_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it(`reason이 정확히 ${REJECT_REASON_MAX_LENGTH}자면 통과한다`, () => {
    const result = ProposalRejectRequestSchema.safeParse({
      reason: "a".repeat(REJECT_REASON_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });
});

describe("ProposalListRpcRowSchema", () => {
  const baseRow = {
    proposal_id: "11111111-1111-4111-8111-111111111111",
    chain_id: "22222222-2222-4222-8222-222222222222",
    chain_name: "반도체 밸류체인",
    proposal_type: "relation_add",
    status: "pending",
    source_node_id: "33333333-3333-4333-8333-333333333333",
    source_display_name: "삼성전자",
    source_node_kind: "listed_company",
    source_ticker: "005930",
    target_node_id: "44444444-4444-4444-8444-444444444444",
    target_display_name: "SK하이닉스",
    target_node_kind: "listed_company",
    target_ticker: "000660",
    relation_type_id: "55555555-5555-4555-8555-555555555555",
    relation_type_name: "공급",
    relation_type_is_active: true,
    disclosure_id: "66666666-6666-4666-8666-666666666666",
    disclosure_title: "공급계약체결",
    disclosure_date: "2026-07-01",
    disclosure_url: "https://dart.fss.or.kr/x",
    disclosure_source: "dart",
    rationale: "공시 내용에 따르면...",
    based_on_snapshot_id: "77777777-7777-4777-8777-777777777777",
    created_at: "2026-07-01T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    resulting_snapshot_id: null,
    is_applicable: true,
    applicability_reason: null,
  };

  it("정상 add 제안 행을 통과시킨다", () => {
    const result = ProposalListRpcRowSchema.safeParse(baseRow);
    expect(result.success).toBe(true);
  });

  it("relation_delete 제안의 relation_type_* NULL 행을 통과시킨다(R-4)", () => {
    const deleteRow = {
      ...baseRow,
      proposal_type: "relation_delete",
      relation_type_id: null,
      relation_type_name: null,
      relation_type_is_active: null,
      applicability_reason: "EDGE_NOT_FOUND",
      is_applicable: false,
    };
    const result = ProposalListRpcRowSchema.safeParse(deleteRow);
    expect(result.success).toBe(true);
  });

  it("disclosure_* 필드가 NULL이어도 통과시킨다(방어)", () => {
    const noDisclosureRow = {
      ...baseRow,
      disclosure_id: null,
      disclosure_title: null,
      disclosure_date: null,
      disclosure_url: null,
      disclosure_source: null,
    };
    const result = ProposalListRpcRowSchema.safeParse(noDisclosureRow);
    expect(result.success).toBe(true);
  });

  it("필수 필드 누락 시 실패한다", () => {
    const invalidRow: Record<string, unknown> = { ...baseRow };
    delete invalidRow.proposal_id;
    const result = ProposalListRpcRowSchema.safeParse(invalidRow);
    expect(result.success).toBe(false);
  });
});
