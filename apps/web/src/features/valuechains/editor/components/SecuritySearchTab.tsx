"use client";

import { useMemo, useState } from "react";
import { MIN_SEARCH_QUERY_LENGTH, SEARCH_DEBOUNCE_MS, type SecurityRef } from "@iib/domain";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSecuritiesSearch } from "@/features/securities/hooks/useSecuritiesSearch";
import { ListingStatusBadge, MarketBadge } from "@/features/securities/components/SecurityBadges";
import { toSecurityRef } from "@/features/valuechains/editor/lib/toSecurityRef";
import type { MarketFilter } from "@/features/explore/state/exploreReducer";

/**
 * 종목 검색 탭(UC-015 plan 모듈 19) — 검색/시장 필터/결과 목록/선택 → 노드 추가.
 * 검색 결과는 reducer에 복사하지 않는다(서버 상태는 TanStack Query 전용).
 */
export interface SecuritySearchTabProps {
  onAdd: (security: SecurityRef) => void;
  /** 이미 추가된 종목 ID — "추가됨" 표시(선택 비활성). */
  usedSecurityIds: ReadonlySet<string>;
  /** 노드 상한 도달 시 true — 검색 입력 자체를 비활성화(E1). */
  disabled: boolean;
}

export function SecuritySearchTab({ onAdd, usedSecurityIds, disabled }: SecuritySearchTabProps) {
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState<MarketFilter>("ALL");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const normalizedQuery = debouncedQuery.trim();
  const enabled = !disabled && normalizedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  const searchResult = useSecuritiesSearch({ query: normalizedQuery, market }, { enabled });

  const items = useMemo(
    () => searchResult.data?.pages.flatMap((page) => page.items) ?? [],
    [searchResult.data],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          role="textbox"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목명 또는 티커 검색"
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100"
        />
        <select
          value={market}
          disabled={disabled}
          onChange={(e) => setMarket(e.target.value as MarketFilter)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="ALL">전체</option>
          <option value="KRX">KRX</option>
          <option value="US">US</option>
        </select>
      </div>

      {enabled && searchResult.isError && (
        <div className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>검색 중 오류가 발생했습니다.</span>
          <button type="button" onClick={() => searchResult.refetch()} className="underline">
            재시도
          </button>
        </div>
      )}

      {enabled && !searchResult.isError && searchResult.isSuccess && items.length === 0 && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
          검색 결과가 없습니다. 자유 주체로 추가해 보세요.
        </p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const alreadyAdded = usedSecurityIds.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => onAdd(toSecurityRef(item))}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <span className="text-sm text-gray-500">{item.ticker}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {alreadyAdded && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        추가됨
                      </span>
                    )}
                    <MarketBadge market={item.market} />
                    <ListingStatusBadge status={item.listingStatus} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {searchResult.hasNextPage && (
        <button
          type="button"
          onClick={() => searchResult.fetchNextPage()}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          더보기
        </button>
      )}
    </div>
  );
}
