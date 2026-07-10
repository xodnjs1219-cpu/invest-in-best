"use client";

import { Input } from "@/components/ui";
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
        <Input
          type="search"
          role="searchbox"
          aria-label="종목 검색"
          value={value}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="티커 또는 종목명 검색"
          className="pr-9"
        />
        {value.length > 0 && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={onClear}
            className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-fg-subtle hover:text-fg-muted"
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
              className={`rounded-sm px-3 py-1 text-sm ${
                isActive
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-sunken text-fg-muted hover:bg-surface-hover"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {showTooShortNotice && (
        <p className="text-sm text-fg-muted">검색어를 입력하면 검색이 실행됩니다.</p>
      )}
    </div>
  );
}
