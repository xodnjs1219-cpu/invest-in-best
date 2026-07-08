import type { ApiError } from "@/lib/http/api-client";
import type { MutationToastMessageKey } from "@/features/admin-llm-proposals/constants";

export type MutationKind = "approve" | "reject";
export type MutationOutcome = "success" | ApiError;

export type ToastVariant = "success" | "info" | "warning" | "error";

export type MutationOutcomePolicy = {
  shouldResolve: boolean;
  shouldInvalidate: boolean;
  toast: { variant: ToastVariant; messageKey: MutationToastMessageKey };
};

/**
 * mutation 결과(성공/ApiError) → dispatch/invalidate/toast 정책(state_management.md §3-3 표 그대로).
 * 순수 함수 — 훅의 onSettled 콜백이 이 결과를 그대로 실행한다.
 */
export const resolveMutationOutcome = (
  kind: MutationKind,
  result: MutationOutcome,
): MutationOutcomePolicy => {
  if (result === "success") {
    return {
      shouldResolve: true,
      shouldInvalidate: true,
      toast: {
        variant: "success",
        messageKey: kind === "approve" ? "approveSuccess" : "rejectSuccess",
      },
    };
  }

  const error = result;

  switch (error.code) {
    case "ADMIN_LLM.PROPOSAL_ALREADY_PROCESSED":
      return {
        shouldResolve: true,
        shouldInvalidate: true,
        toast: {
          variant: "info",
          messageKey: kind === "approve" ? "approveAlreadyProcessed" : "rejectAlreadyProcessed",
        },
      };

    case "ADMIN_LLM.PROPOSAL_CONFLICT":
      return {
        shouldResolve: true,
        shouldInvalidate: true,
        toast: { variant: "warning", messageKey: "approveConflict" },
      };

    case "ADMIN_LLM.RELATION_TYPE_INACTIVE":
      return {
        shouldResolve: false,
        shouldInvalidate: true,
        toast: { variant: "warning", messageKey: "approveRelationTypeInactive" },
      };

    case "ADMIN_LLM.CHAIN_NOT_APPLICABLE":
      return {
        shouldResolve: false,
        shouldInvalidate: true,
        toast: { variant: "warning", messageKey: "approveChainNotApplicable" },
      };

    case "ADMIN_LLM.PROPOSAL_NOT_FOUND":
    case "ADMIN_LLM.INVALID_REQUEST":
      return {
        shouldResolve: true,
        shouldInvalidate: true,
        toast: { variant: "info", messageKey: "notFound" },
      };

    case "ADMIN_LLM.APPROVAL_FAILED":
      return {
        shouldResolve: false,
        shouldInvalidate: false,
        toast: { variant: "error", messageKey: "approveFailed" },
      };

    case "ADMIN_LLM.REJECTION_FAILED":
      return {
        shouldResolve: false,
        shouldInvalidate: false,
        toast: { variant: "error", messageKey: "rejectFailed" },
      };

    default:
      return {
        shouldResolve: false,
        shouldInvalidate: false,
        toast: {
          variant: "error",
          messageKey: kind === "approve" ? "approveFailed" : "rejectFailed",
        },
      };
  }
};
