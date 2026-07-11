"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { Heading } from "@/components/ui";
import { SearchBar } from "@/features/explore/components/SearchBar";
import { useDebouncedQueryCommit } from "@/features/explore/hooks/useDebouncedQueryCommit";
import {
  EXPLORE_INITIAL_STATE,
  exploreReducer,
  selectIsSearchActive,
  selectShowTooShortNotice,
} from "@/features/explore/state/exploreReducer";
import { SearchResultsSection } from "@/features/securities/components/SearchResultsSection";
import { useSecuritiesSearch } from "@/features/securities/hooks/useSecuritiesSearch";
import { ApiError } from "@/lib/http/api-client";

const companyPath = (ticker: string): string => `/companies/${ticker}`;

/**
 * 종목 검색 페이지 컨테이너 (UC-008) — 밸류체인 탐색(/explore)에서 분리된 전용 페이지.
 * 검색 상태(reducer + 디바운스 커밋)와 서버 검색 쿼리를 배선하고,
 * 결과 선택 시 종목 상세(/companies/[ticker])로 이동한다.
 */
export function StockSearchPage() {
  const router = useRouter();

  const [searchState, dispatch] = useReducer(exploreReducer, EXPLORE_INITIAL_STATE);
  useDebouncedQueryCommit(searchState.searchInput, dispatch);
  const isSearchActive = selectIsSearchActive(searchState);
  const showTooShortNotice = selectShowTooShortNotice(searchState);

  const searchQuery = useSecuritiesSearch(
    { query: searchState.submittedQuery, market: searchState.marketFilter },
    { enabled: isSearchActive },
  );
  const searchItems = searchQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const searchErrorCode =
    searchQuery.error instanceof ApiError ? searchQuery.error.code : undefined;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Heading level={1}>종목 검색</Heading>
        <p className="text-sm text-fg-muted">
          티커 또는 종목명으로 KRX·US 상장기업을 검색하고, 시세·재무·소속 밸류체인을 확인합니다.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <SearchBar
          value={searchState.searchInput}
          marketFilter={searchState.marketFilter}
          showTooShortNotice={showTooShortNotice}
          onInputChange={(value) => dispatch({ type: "SEARCH_INPUT_CHANGED", payload: { value } })}
          onFilterChange={(market) =>
            dispatch({ type: "SEARCH_MARKET_FILTER_CHANGED", payload: { market } })
          }
          onClear={() => dispatch({ type: "SEARCH_CLEARED" })}
        />
        {isSearchActive && (
          <SearchResultsSection
            items={searchItems}
            isPending={searchQuery.isPending}
            isError={searchQuery.isError}
            hasNextPage={Boolean(searchQuery.hasNextPage)}
            isFetchingNextPage={searchQuery.isFetchingNextPage}
            errorCode={searchErrorCode}
            onLoadMore={() => searchQuery.fetchNextPage()}
            onRetry={() => searchQuery.refetch()}
            onSelect={(ticker) => router.push(companyPath(ticker))}
          />
        )}
      </section>
    </main>
  );
}
