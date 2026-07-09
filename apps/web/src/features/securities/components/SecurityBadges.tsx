import type { MarketCode } from "@iib/domain";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { LISTING_STATUSES } from "@/features/securities/backend/schema";

type ListingStatus = (typeof LISTING_STATUSES)[number];

/** 시장별 배지 톤 — KRX=data(cyan 계열), US=accent(violet 계열)로 대비. 디자인 시스템 Badge에 위임. */
const MARKET_TONE: Record<MarketCode, BadgeTone> = {
  KRX: "data",
  US: "accent",
};

/**
 * 시장 배지(KRX/US) — 공용 Badge 프리미티브에 위임(디자인 시스템 통일).
 * 검색 결과·기업 상세·마인드맵 노드 어디서나 동일한 시각 언어로 렌더된다.
 */
export function MarketBadge({ market }: { market: MarketCode }) {
  return <Badge tone={MARKET_TONE[market]}>{market}</Badge>;
}

/** 상장 상태별 라벨. `listed`는 배지를 표시하지 않는다(결정 B-5). */
const LISTING_STATUS_LABELS: Partial<Record<ListingStatus, string>> = {
  suspended: "거래정지",
  delisted: "상장폐지",
};

/** 상장 상태별 배지 톤 — 거래정지=warning, 상장폐지=neutral(회색). */
const LISTING_STATUS_TONE: Partial<Record<ListingStatus, BadgeTone>> = {
  suspended: "warning",
  delisted: "neutral",
};

/**
 * 상장 상태 배지 — `listed`는 렌더링하지 않는다(결정 B-5: 정지/폐지만 표기).
 */
export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const label = LISTING_STATUS_LABELS[status];
  const tone = LISTING_STATUS_TONE[status];
  if (!label || !tone) {
    return null;
  }

  return <Badge tone={tone}>{label}</Badge>;
}
