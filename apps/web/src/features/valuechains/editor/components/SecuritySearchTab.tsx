"use client";

import { useMemo, useState } from "react";
import { MIN_SEARCH_QUERY_LENGTH, SEARCH_DEBOUNCE_MS, type SecurityRef } from "@iib/domain";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSecuritiesSearch } from "@/features/securities/hooks/useSecuritiesSearch";
import { ListingStatusBadge, MarketBadge } from "@/features/securities/components/SecurityBadges";
import { toSecurityRef } from "@/features/valuechains/editor/lib/toSecurityRef";
import type { MarketFilter } from "@/features/explore/state/exploreReducer";
import { Badge, Button, Input, Select } from "@/components/ui";

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
      {/* 검색 입력은 항상 한 줄 전체 폭을 차지하고, 시장 필터는 아래 줄로 내려 좁은 사이드 패널에서도
          입력창이 넉넉하게 보이도록 한다. */}
      <Input
        type="text"
        role="textbox"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="종목명 또는 티커 검색"
      />
      <Select
        value={market}
        disabled={disabled}
        onChange={(e) => setMarket(e.target.value as MarketFilter)}
        aria-label="시장 필터"
      >
        <option value="ALL">전체 시장</option>
        <option value="KRX">KRX</option>
        <option value="US">US</option>
      </Select>

      {enabled && searchResult.isError && (
        <div className="flex items-center justify-between rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-sm text-danger">
          <span>종목 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.</span>
          {/* ui-exception: danger 인라인 배너 내부 텍스트 버튼 — 배너 색을 상속해야 해 Button 프리미티브 밖 */}
          <button type="button" onClick={() => searchResult.refetch()} className="underline">
            재시도
          </button>
        </div>
      )}

      {enabled && !searchResult.isError && searchResult.isSuccess && items.length === 0 && (
        <p className="rounded-[var(--radius)] bg-surface-sunken px-3 py-2 text-sm text-fg-muted">
          검색 결과가 없습니다. 자유 주체로 추가해 보세요.
        </p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const alreadyAdded = usedSecurityIds.has(item.id);
            return (
              <li key={item.id}>
                {/* ui-exception: 전폭 리스트 선택 로우 — Button 프리미티브 형태 계약 밖, 토큰 클래스만 사용 */}
                <button
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => onAdd(toSecurityRef(item))}
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2 text-left hover:bg-surface-hover disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-fg">{item.name}</span>
                    <span className="text-sm text-fg-muted">{item.ticker}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {alreadyAdded && <Badge tone="neutral">추가됨</Badge>}
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
        <Button type="button" variant="secondary" size="sm" onClick={() => searchResult.fetchNextPage()}>
          더보기
        </Button>
      )}
    </div>
  );
}
