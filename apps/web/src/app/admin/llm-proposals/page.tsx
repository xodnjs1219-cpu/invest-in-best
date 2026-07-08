"use client";

import { useReducer, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ProposalDetailPanel } from "@/features/admin-llm-proposals/components/ProposalDetailPanel";
import { ProposalFilterTabs } from "@/features/admin-llm-proposals/components/ProposalFilterTabs";
import { ProposalPagination } from "@/features/admin-llm-proposals/components/ProposalPagination";
import { ProposalTable } from "@/features/admin-llm-proposals/components/ProposalTable";
import { RejectReasonDialog } from "@/features/admin-llm-proposals/components/RejectReasonDialog";
import { MUTATION_TOAST_MESSAGES } from "@/features/admin-llm-proposals/constants";
import {
  adminLlmQueueReducer,
  initialAdminLlmQueueState,
} from "@/features/admin-llm-proposals/hooks/adminLlmQueueReducer";
import { resolveMutationOutcome, type ToastVariant } from "@/features/admin-llm-proposals/hooks/mutationResultPolicy";
import { useApproveProposal } from "@/features/admin-llm-proposals/hooks/useApproveProposal";
import {
  PROPOSAL_LIST_QUERY_KEY_PREFIX,
  useProposalListQuery,
} from "@/features/admin-llm-proposals/hooks/useProposalListQuery";
import { useRejectProposal } from "@/features/admin-llm-proposals/hooks/useRejectProposal";
import { ApiError } from "@/lib/http/api-client";

type Toast = { variant: ToastVariant; message: string };

const toastStyles: Record<ToastVariant, string> = {
  success: "bg-green-600",
  info: "bg-blue-600",
  warning: "bg-yellow-600",
  error: "bg-red-600",
};

/**
 * `/admin/llm-proposals` 페이지 컨테이너(state_management.md §3-4).
 * useReducer + 쿼리/뮤테이션을 소유하고 Presenter에 값+콜백을 배선한다.
 * 낙관적 갱신 없음 — mutation 확정 후 invalidateQueries로 재조회한다(원칙 3).
 */
export default function AdminLlmProposalsPage() {
  const [state, dispatch] = useReducer(adminLlmQueueReducer, initialAdminLlmQueueState);
  const [toast, setToast] = useState<Toast | null>(null);
  const queryClient = useQueryClient();

  const listQuery = useProposalListQuery(state.statusFilter, state.page);
  const approveMutation = useApproveProposal();
  const rejectMutation = useRejectProposal();

  const items = listQuery.data?.items ?? [];
  const selectedProposal = items.find((item) => item.proposalId === state.selectedProposalId) ?? null;
  const processingProposalId =
    (approveMutation.isPending && approveMutation.variables?.proposalId) ||
    (rejectMutation.isPending && rejectMutation.variables?.proposalId) ||
    null;

  const showToast = (variant: ToastVariant, message: string) => {
    setToast({ variant, message });
  };

  const handleApprove = (proposalId: string) => {
    approveMutation.mutate(
      { proposalId },
      {
        onSettled: (_data, error) => {
          const outcome = resolveMutationOutcome("approve", error instanceof ApiError ? error : "success");
          if (outcome.shouldResolve) {
            dispatch({ type: "PROPOSAL_RESOLVED", proposalId });
          }
          if (outcome.shouldInvalidate) {
            queryClient.invalidateQueries({ queryKey: PROPOSAL_LIST_QUERY_KEY_PREFIX });
          }
          showToast(outcome.toast.variant, MUTATION_TOAST_MESSAGES[outcome.toast.messageKey]);
        },
      },
    );
  };

  const handleRejectConfirm = () => {
    const target = state.rejectTarget;
    if (!target) {
      return;
    }
    rejectMutation.mutate(
      { proposalId: target.proposalId, reason: target.reason.trim() || undefined },
      {
        onSettled: (_data, error) => {
          const outcome = resolveMutationOutcome("reject", error instanceof ApiError ? error : "success");
          if (outcome.shouldResolve) {
            dispatch({ type: "PROPOSAL_RESOLVED", proposalId: target.proposalId });
          }
          if (outcome.shouldInvalidate) {
            queryClient.invalidateQueries({ queryKey: PROPOSAL_LIST_QUERY_KEY_PREFIX });
          }
          showToast(outcome.toast.variant, MUTATION_TOAST_MESSAGES[outcome.toast.messageKey]);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">LLM 관계 변경안 검토 큐</h1>

      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded px-4 py-2 text-sm text-white shadow-lg ${toastStyles[toast.variant]}`}
        >
          {toast.message}
        </div>
      )}

      <ProposalFilterTabs
        value={state.statusFilter}
        onChange={(filter) => dispatch({ type: "FILTER_CHANGED", filter })}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProposalTable
            items={items}
            isLoading={listQuery.isPending}
            isError={listQuery.isError}
            onRetry={() => listQuery.refetch()}
            selectedProposalId={state.selectedProposalId}
            processingProposalId={processingProposalId || null}
            onSelect={(proposalId) => dispatch({ type: "PROPOSAL_SELECTED", proposalId })}
            onApprove={handleApprove}
            onRejectClick={(proposalId) => dispatch({ type: "REJECT_DIALOG_OPENED", proposalId })}
          />
          <ProposalPagination
            page={state.page}
            hasMore={listQuery.data?.hasMore ?? false}
            onPageChange={(page) => dispatch({ type: "PAGE_CHANGED", page })}
          />
        </div>

        <ProposalDetailPanel
          proposal={selectedProposal}
          isProcessing={processingProposalId === selectedProposal?.proposalId}
          onClose={() => dispatch({ type: "PANEL_CLOSED" })}
          onApprove={handleApprove}
          onRejectClick={(proposalId) => dispatch({ type: "REJECT_DIALOG_OPENED", proposalId })}
        />
      </div>

      <RejectReasonDialog
        target={state.rejectTarget}
        isSubmitting={rejectMutation.isPending}
        onReasonChange={(reason) => dispatch({ type: "REJECT_REASON_CHANGED", reason })}
        onCancel={() => dispatch({ type: "REJECT_DIALOG_CLOSED" })}
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
}
