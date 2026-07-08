import type { MarketCode } from "@iib/domain";
import type { LISTING_STATUSES } from "@/features/securities/backend/schema";

type ListingStatus = (typeof LISTING_STATUSES)[number];

const MARKET_BADGE_STYLES: Record<MarketCode, string> = {
  KRX: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  US: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20",
};

/** 시장 배지(KRX/US) — 순수 Presenter. UC-020 기업 상세에서 재사용 예정(공통 후보). */
export function MarketBadge({ market }: { market: MarketCode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${MARKET_BADGE_STYLES[market]}`}
    >
      {market}
    </span>
  );
}

/** 상장 상태별 라벨. `listed`는 배지를 표시하지 않는다(결정 B-5). */
const LISTING_STATUS_LABELS: Partial<Record<ListingStatus, string>> = {
  suspended: "거래정지",
  delisted: "상장폐지",
};

const LISTING_STATUS_BADGE_STYLES: Partial<Record<ListingStatus, string>> = {
  suspended: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  delisted: "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-500/20",
};

/**
 * 상장 상태 배지 — `listed`는 렌더링하지 않는다(결정 B-5: 정지/폐지만 표기).
 * UC-020(기업 상세) plan에서 재사용 예정(공통 후보).
 */
export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const label = LISTING_STATUS_LABELS[status];
  if (!label) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${LISTING_STATUS_BADGE_STYLES[status]}`}
    >
      {label}
    </span>
  );
}
