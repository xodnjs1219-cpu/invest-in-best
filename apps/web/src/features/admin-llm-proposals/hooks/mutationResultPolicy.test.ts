import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http/api-client";
import { resolveMutationOutcome } from "@/features/admin-llm-proposals/hooks/mutationResultPolicy";

describe("resolveMutationOutcome — approve", () => {
  it("200 성공 → resolve+invalidate+승인 완료 토스트", () => {
    const result = resolveMutationOutcome("approve", "success");
    expect(result.shouldResolve).toBe(true);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "success", messageKey: "approveSuccess" });
  });

  it("409 PROPOSAL_ALREADY_PROCESSED → resolve+invalidate+'이미 처리' 토스트", () => {
    const error = new ApiError("ADMIN_LLM.PROPOSAL_ALREADY_PROCESSED", 409, "이미 처리됨");
    const result = resolveMutationOutcome("approve", error);
    expect(result.shouldResolve).toBe(true);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "info", messageKey: "approveAlreadyProcessed" });
  });

  it("409 PROPOSAL_CONFLICT → resolve+invalidate+'자동 무효' 토스트", () => {
    const error = new ApiError("ADMIN_LLM.PROPOSAL_CONFLICT", 409, "충돌");
    const result = resolveMutationOutcome("approve", error);
    expect(result.shouldResolve).toBe(true);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "warning", messageKey: "approveConflict" });
  });

  it("422 RELATION_TYPE_INACTIVE → resolve 없음 + invalidate + 차단 사유 토스트", () => {
    const error = new ApiError("ADMIN_LLM.RELATION_TYPE_INACTIVE", 422, "비활성");
    const result = resolveMutationOutcome("approve", error);
    expect(result.shouldResolve).toBe(false);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "warning", messageKey: "approveRelationTypeInactive" });
  });

  it("422 CHAIN_NOT_APPLICABLE → resolve 없음 + invalidate + 차단 사유 토스트", () => {
    const error = new ApiError("ADMIN_LLM.CHAIN_NOT_APPLICABLE", 422, "부적격");
    const result = resolveMutationOutcome("approve", error);
    expect(result.shouldResolve).toBe(false);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "warning", messageKey: "approveChainNotApplicable" });
  });

  it("500 APPROVAL_FAILED → resolve·invalidate 없음 + 재시도 토스트", () => {
    const error = new ApiError("ADMIN_LLM.APPROVAL_FAILED", 500, "실패");
    const result = resolveMutationOutcome("approve", error);
    expect(result.shouldResolve).toBe(false);
    expect(result.shouldInvalidate).toBe(false);
    expect(result.toast).toEqual({ variant: "error", messageKey: "approveFailed" });
  });

  it("404 PROPOSAL_NOT_FOUND → resolve+invalidate+'대상 없음' 토스트", () => {
    const error = new ApiError("ADMIN_LLM.PROPOSAL_NOT_FOUND", 404, "없음");
    const result = resolveMutationOutcome("approve", error);
    expect(result.shouldResolve).toBe(true);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "info", messageKey: "notFound" });
  });

  it("400 INVALID_REQUEST → resolve+invalidate+'대상 없음' 토스트", () => {
    const error = new ApiError("ADMIN_LLM.INVALID_REQUEST", 400, "잘못된 요청");
    const result = resolveMutationOutcome("approve", error);
    expect(result.shouldResolve).toBe(true);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "info", messageKey: "notFound" });
  });
});

describe("resolveMutationOutcome — reject", () => {
  it("200 성공 → resolve+invalidate+거부 완료 토스트", () => {
    const result = resolveMutationOutcome("reject", "success");
    expect(result.shouldResolve).toBe(true);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "success", messageKey: "rejectSuccess" });
  });

  it("409 PROPOSAL_ALREADY_PROCESSED → resolve+invalidate", () => {
    const error = new ApiError("ADMIN_LLM.PROPOSAL_ALREADY_PROCESSED", 409, "이미 처리됨");
    const result = resolveMutationOutcome("reject", error);
    expect(result.shouldResolve).toBe(true);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "info", messageKey: "rejectAlreadyProcessed" });
  });

  it("500 REJECTION_FAILED → resolve 없음(다이얼로그 유지) + invalidate 없음", () => {
    const error = new ApiError("ADMIN_LLM.REJECTION_FAILED", 500, "실패");
    const result = resolveMutationOutcome("reject", error);
    expect(result.shouldResolve).toBe(false);
    expect(result.shouldInvalidate).toBe(false);
    expect(result.toast).toEqual({ variant: "error", messageKey: "rejectFailed" });
  });

  it("404 PROPOSAL_NOT_FOUND → resolve+invalidate+'대상 없음' 토스트", () => {
    const error = new ApiError("ADMIN_LLM.PROPOSAL_NOT_FOUND", 404, "없음");
    const result = resolveMutationOutcome("reject", error);
    expect(result.shouldResolve).toBe(true);
    expect(result.shouldInvalidate).toBe(true);
    expect(result.toast).toEqual({ variant: "info", messageKey: "notFound" });
  });
});
