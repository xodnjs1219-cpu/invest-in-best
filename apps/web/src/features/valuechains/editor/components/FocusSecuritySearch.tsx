"use client";

import { useMemo, useState } from "react";
import { MIN_SEARCH_QUERY_LENGTH, SEARCH_DEBOUNCE_MS, type SecurityRef } from "@iib/domain";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSecuritiesSearch } from "@/features/securities/hooks/useSecuritiesSearch";
import { ListingStatusBadge, MarketBadge } from "@/features/securities/components/SecurityBadges";
import { toSecurityRef } from "@/features/valuechains/editor/lib/toSecurityRef";
import type { MarketFilter } from "@/features/explore/state/exploreReducer";

/**
 * 대상 기업 검색 (UC-013 plan 모듈 20).
 * 검색어/시장 필터는 로컬 상태(문서 상태 아님) — 디바운스 후 useSecuritiesSearch로 조회한다.
 * 결과 선택 시 onSelect(SecurityRef)를 호출하고 검색어를 초기화한다.
 * 결과 없음(E8): 대상 기업 없이 진행 가능함을 안내(오류 아님).
 */
export interface FocusSecuritySearchProps {
  onSelect: (security: SecurityRef) => void;
}

export function FocusSecuritySearch({ onSelect }: FocusSecuritySearchProps) {
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState<MarketFilter>("ALL");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const normalizedQuery = debouncedQuery.trim();
  const enabled = normalizedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  const searchResult = useSecuritiesSearch({ query: normalizedQuery, market }, { enabled });

  const items = useMemo(
    () => searchResult.data?.pages.flatMap((page) => page.items) ?? [],
    [searchResult.data],
  );

  const handleSelect = (item: (typeof items)[number]) => {
    onSelect(toSecurityRef(item));
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          role="textbox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목명 또는 티커 검색"
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          value={market}
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
          검색 결과 없음 — 대상 기업 없이 진행할 수 있습니다.
        </p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  <span className="text-sm text-gray-500">{item.ticker}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <MarketBadge market={item.market} />
                  <ListingStatusBadge status={item.listingStatus} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
