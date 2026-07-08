/**
 * admin-llm-proposals 기능 에러 코드(spec §6.2 Error Codes 그대로).
 * 401/403 공통 Admin 인증 에러는 `@/backend/middleware/admin`의 `adminAuthErrorCodes` 소관.
 */
export const adminLlmProposalErrorCodes = {
  invalidRequest: "ADMIN_LLM.INVALID_REQUEST",
  proposalsFetchError: "ADMIN_LLM.PROPOSALS_FETCH_ERROR",
  proposalNotFound: "ADMIN_LLM.PROPOSAL_NOT_FOUND",
  proposalAlreadyProcessed: "ADMIN_LLM.PROPOSAL_ALREADY_PROCESSED",
  proposalConflict: "ADMIN_LLM.PROPOSAL_CONFLICT",
  relationTypeInactive: "ADMIN_LLM.RELATION_TYPE_INACTIVE",
  chainNotApplicable: "ADMIN_LLM.CHAIN_NOT_APPLICABLE",
  approvalFailed: "ADMIN_LLM.APPROVAL_FAILED",
  rejectionFailed: "ADMIN_LLM.REJECTION_FAILED",
} as const;

export type AdminLlmProposalServiceError =
  (typeof adminLlmProposalErrorCodes)[keyof typeof adminLlmProposalErrorCodes];
