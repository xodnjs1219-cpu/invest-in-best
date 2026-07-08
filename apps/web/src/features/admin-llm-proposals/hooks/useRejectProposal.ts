"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "@/lib/http/api-client";
import type { ProposalRejectResponse } from "@/features/admin-llm-proposals/backend/schema";

export type RejectProposalVariables = { proposalId: string; reason?: string };

/** 거부 뮤테이션 훅 — 재시도 없음. reason이 빈 문자열이면 body에서 생략한다. */
export const useRejectProposal = (): UseMutationResult<
  ProposalRejectResponse,
  ApiError,
  RejectProposalVariables
> =>
  useMutation({
    mutationFn: ({ proposalId, reason }) =>
      apiFetch<ProposalRejectResponse>(`/admin/llm-proposals/${proposalId}/reject`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      }),
    retry: 0,
  });
