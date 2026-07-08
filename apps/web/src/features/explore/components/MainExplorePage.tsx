"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/features/auth/context/current-user-provider";
import { CreateChainButton } from "@/features/explore/components/CreateChainButton";
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
import { ChainCardsSection } from "@/features/valuechains/components/ChainCardsSection";
import { CloneChainButton } from "@/features/valuechains/components/CloneChainButton";
import { DeleteChainButton } from "@/features/valuechains/components/DeleteChainButton";
import { useMyChainCards } from "@/features/valuechains/hooks/useMyChainCards";
import { useOfficialChainCards } from "@/features/valuechains/hooks/useOfficialChainCards";
import { ApiError } from "@/lib/http/api-client";

const chainViewPath = (chainId: string): string => `/valuechains/${chainId}`;
const companyPath = (ticker: string): string => `/companies/${ticker}`;

/**
 * 메인/탐색 페이지 컨테이너 (UC-007 plan 모듈 E-2, UC-008 검색 모듈 장착).
 * `'use client'` — 본 페이지의 유일한 로직-표시 결합 지점. 서버 상태(TanStack Query)를
 * 로컬 상태로 복제하지 않고 파생만 하며, Presenter에는 의도가 드러나는 핸들러만 전달한다.
 */
export function MainExplorePage() {
  const router = useRouter();
  const { status } = useCurrentUser();
  const isAuthenticated = status === "authenticated";

  // ── 검색(UC-008 소관 모듈 연결) ─────────────────────────
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

  // ── 공식 밸류체인 목록 ─────────────────────────────────
  const officialQuery = useOfficialChainCards();
  const officialItems = officialQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // ── 내 밸류체인 목록(로그인 시에만 활성) ────────────────
  const myQuery = useMyChainCards({ enabled: isAuthenticated });
  const myItems = myQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const isMyChainsUnauthorized =
    myQuery.error instanceof ApiError && myQuery.error.status === 401;
  // 비로그인 또는 세션 만료(401)면 내 체인 섹션 자체를 숨긴다(게스트 뷰, 엣지 4·7).
  const showMyChainsSection = isAuthenticated && !isMyChainsUnauthorized;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
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

      <div className="flex justify-end">
        <CreateChainButton isAuthenticated={isAuthenticated} />
      </div>

      <ChainCardsSection
        title="공식 밸류체인"
        items={officialItems}
        isPending={officialQuery.isPending}
        isError={officialQuery.isError}
        hasNextPage={Boolean(officialQuery.hasNextPage)}
        isFetchingNextPage={officialQuery.isFetchingNextPage}
        emptyVariant="official"
        onLoadMore={() => officialQuery.fetchNextPage()}
        onRetry={() => officialQuery.refetch()}
        onSelect={(chainId) => router.push(chainViewPath(chainId))}
        renderCardActions={(card) => <CloneChainButton chainId={card.id} variant="card" />}
      />

      {showMyChainsSection && (
        <ChainCardsSection
          title="내 밸류체인"
          items={myItems}
          isPending={myQuery.isPending}
          isError={myQuery.isError}
          hasNextPage={Boolean(myQuery.hasNextPage)}
          isFetchingNextPage={myQuery.isFetchingNextPage}
          emptyVariant="mine"
          onLoadMore={() => myQuery.fetchNextPage()}
          onRetry={() => myQuery.refetch()}
          onSelect={(chainId) => router.push(chainViewPath(chainId))}
          renderCardActions={(card) => (
            <DeleteChainButton chainId={card.id} chainName={card.name} source="list" variant="card" />
          )}
        />
      )}
    </div>
  );
}
