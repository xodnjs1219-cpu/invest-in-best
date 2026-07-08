"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "@/lib/http/api-client";
import type { ProposalApproveResponse } from "@/features/admin-llm-proposals/backend/schema";

export type ApproveProposalVariables = { proposalId: string };

/** 승인 뮤테이션 훅 — 재시도 없음(비멱등 UX, E14는 사용자 수동 재시도). */
export const useApproveProposal = (): UseMutationResult<
  ProposalApproveResponse,
  ApiError,
  ApproveProposalVariables
> =>
  useMutation({
    mutationFn: ({ proposalId }) =>
      apiFetch<ProposalApproveResponse>(`/admin/llm-proposals/${proposalId}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    retry: 0,
  });
