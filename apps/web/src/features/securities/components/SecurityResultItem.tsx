import { ListingStatusBadge, MarketBadge } from "@/features/securities/components/SecurityBadges";
import type { SecuritySearchItem } from "@/features/securities/lib/dto";

type SecurityResultItemProps = {
  item: SecuritySearchItem;
  onSelect: (ticker: string) => void;
};

/**
 * 검색 결과 1행 Presenter — 종목명·티커·영문명(선택)·시장 배지·상태 배지.
 * 라우팅 로직 없음(콜백만) — 클릭/Enter 시 onSelect(ticker)를 호출한다.
 */
export function SecurityResultItem({ item, onSelect }: SecurityResultItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.ticker)}
      className="flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2 text-left hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-fg">{item.name}</span>
          <span className="shrink-0 text-sm text-fg-muted">{item.ticker}</span>
        </span>
        {item.englishName && (
          <span className="truncate text-sm text-fg-muted">{item.englishName}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <MarketBadge market={item.market} />
        <ListingStatusBadge status={item.listingStatus} />
      </span>
    </button>
  );
}
