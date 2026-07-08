"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/api-client";
import type { ProposalListResponse } from "@/features/admin-llm-proposals/backend/schema";
import type { ProposalStatusFilter } from "@/features/admin-llm-proposals/hooks/adminLlmQueueReducer";

/** 쿼리 키 prefix — `invalidateQueries({ queryKey: PROPOSAL_LIST_QUERY_KEY_PREFIX })`로 전체 무효화한다. */
export const PROPOSAL_LIST_QUERY_KEY_PREFIX = ["admin", "llm-proposals"] as const;

/** 목록 조회 쿼리 키. */
export const proposalListQueryKey = (status: ProposalStatusFilter, page: number) =>
  [...PROPOSAL_LIST_QUERY_KEY_PREFIX, { status, page }] as const;

/**
 * 검토 큐 목록 조회 훅(state_management.md §3-3). 페이지 전환 시 깜빡임 방지를 위해
 * `placeholderData: keepPreviousData`를 사용한다.
 */
export const useProposalListQuery = (
  status: ProposalStatusFilter,
  page: number,
): UseQueryResult<ProposalListResponse> =>
  useQuery({
    queryKey: proposalListQueryKey(status, page),
    queryFn: () =>
      apiFetch<ProposalListResponse>(`/admin/llm-proposals?status=${status}&page=${page}`),
    placeholderData: keepPreviousData,
  });
