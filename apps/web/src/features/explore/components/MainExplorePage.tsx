"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEARCH_DEBOUNCE_MS } from "@iib/domain";
import { Heading, Input } from "@/components/ui";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCurrentUser } from "@/features/auth/context/current-user-provider";
import { CreateChainButton } from "@/features/explore/components/CreateChainButton";
import { ChainCardsSection } from "@/features/valuechains/components/ChainCardsSection";
import { CloneChainButton } from "@/features/valuechains/components/CloneChainButton";
import { DeleteChainButton } from "@/features/valuechains/components/DeleteChainButton";
import { useMyChainCards } from "@/features/valuechains/hooks/useMyChainCards";
import { useOfficialChainCards } from "@/features/valuechains/hooks/useOfficialChainCards";
import { ApiError } from "@/lib/http/api-client";

const chainViewPath = (chainId: string): string => `/valuechains/${chainId}`;

/**
 * 밸류체인 탐색 페이지 컨테이너 (UC-007 plan 모듈 E-2).
 * 종목 검색(UC-008)은 별도 페이지(/stocks — StockSearchPage)로 분리됐다.
 * `'use client'` — 본 페이지의 유일한 로직-표시 결합 지점. 서버 상태(TanStack Query)를
 * 로컬 상태로 복제하지 않고 파생만 하며, Presenter에는 의도가 드러나는 핸들러만 전달한다.
 */
export function MainExplorePage() {
  const router = useRouter();
  const { status } = useCurrentUser();
  const isAuthenticated = status === "authenticated";

  // ── 체인 검색(이름/포함 종목) — 디바운스 후 목록 쿼리 파라미터로 위임 ────
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const chainSearch = debouncedSearch.trim() || undefined;

  // ── 공식 밸류체인 목록 ─────────────────────────────────
  const officialQuery = useOfficialChainCards({ search: chainSearch });
  const officialItems = officialQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // ── 내 밸류체인 목록(로그인 시에만 활성) ────────────────
  const myQuery = useMyChainCards({ enabled: isAuthenticated, search: chainSearch });
  const myItems = myQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const isMyChainsUnauthorized =
    myQuery.error instanceof ApiError && myQuery.error.status === 401;
  // 비로그인 또는 세션 만료(401)면 내 체인 섹션 자체를 숨긴다(게스트 뷰, 엣지 4·7).
  const showMyChainsSection = isAuthenticated && !isMyChainsUnauthorized;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <Heading level={1}>밸류체인 탐색</Heading>

      {/* 체인 검색 — 이름 또는 포함 종목(종목명/티커/자유 주체)으로 공식·내 체인을 함께 필터 */}
      <div className="relative flex items-center">
        <Input
          type="search"
          role="searchbox"
          aria-label="밸류체인 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="체인 이름 또는 포함 종목으로 검색 (예: 반도체, 삼성전자)"
          className="pr-9"
        />
        {searchInput.length > 0 && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => setSearchInput("")}
            className="absolute right-1 flex h-8 w-8 items-center justify-center rounded-full text-fg-subtle hover:text-fg-muted"
          >
            ×
          </button>
        )}
      </div>

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
    </main>
  );
}
