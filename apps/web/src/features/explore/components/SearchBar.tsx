"use client";

import type { MarketFilter } from "@/features/explore/state/exploreReducer";

type MarketFilterTab = { value: MarketFilter; label: string };

const MARKET_FILTER_TABS: MarketFilterTab[] = [
  { value: "ALL", label: "전체" },
  { value: "KRX", label: "KRX" },
  { value: "US", label: "US" },
];

type SearchBarProps = {
  value: string;
  marketFilter: MarketFilter;
  showTooShortNotice: boolean;
  onInputChange: (value: string) => void;
  onFilterChange: (market: MarketFilter) => void;
  onClear: () => void;
};

/**
 * 검색 입력 + 시장 필터 탭 + 지우기(X) + "검색 미실행" 안내 — Presenter(로직 없음).
 * dispatch·Action 타입을 모른다(state_management.md §7 인터페이스 그대로).
 */
export function SearchBar({
  value,
  marketFilter,
  showTooShortNotice,
  onInputChange,
  onFilterChange,
  onClear,
}: SearchBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex items-center">
        <input
          type="search"
          role="searchbox"
          aria-label="종목 검색"
          value={value}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="티커 또는 종목명 검색"
          className="w-full rounded-md border border-gray-300 px-3 py-2 pr-9 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
        {value.length > 0 && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={onClear}
            className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      <div role="tablist" aria-label="시장 필터" className="flex flex-wrap gap-1">
        {MARKET_FILTER_TABS.map((tab) => {
          const isActive = tab.value === marketFilter;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onFilterChange(tab.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {showTooShortNotice && (
        <p className="text-sm text-gray-500">검색어를 입력하면 검색이 실행됩니다.</p>
      )}
    </div>
  );
}
