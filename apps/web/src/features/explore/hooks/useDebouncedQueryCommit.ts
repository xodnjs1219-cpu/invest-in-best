"use client";

import { useEffect, type Dispatch } from "react";
import { SEARCH_DEBOUNCE_MS, normalizeSearchQuery } from "@iib/domain";
import type { ExploreAction } from "@/features/explore/state/exploreReducer";

/**
 * searchInput 변경을 감시해 SEARCH_DEBOUNCE_MS(300ms) 후 정규화된 값으로
 * SEARCH_QUERY_COMMITTED를 dispatch한다. 재변경 시 타이머 재시작, 언마운트 시 취소.
 * 정규화는 dispatch **이전** 이펙트 계층에서 수행한다 — reducer 순수성 유지(state_management.md §5).
 */
export function useDebouncedQueryCommit(
  searchInput: string,
  dispatch: Dispatch<ExploreAction>,
): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({
        type: "SEARCH_QUERY_COMMITTED",
        payload: { normalizedQuery: normalizeSearchQuery(searchInput) },
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput, dispatch]);
}
