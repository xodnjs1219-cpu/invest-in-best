"use client";

import { formatInTimeZone } from "date-fns-tz";
import { TIMELINE_TIMEZONE } from "@iib/domain";
import { useChainViewState } from "@/features/valuechains/context/chain-view-context";

const FRESHNESS_LABELS = {
  quotes: "시세",
  financials: "재무",
  fxAndMarketHours: "환율/장운영",
} as const;

const formatCollectedAt = (iso: string | null): string => {
  if (!iso) {
    return "수집 전";
  }
  return formatInTimeZone(new Date(iso), TIMELINE_TIMEZONE, "yyyy-MM-dd HH:mm");
};

/**
 * 데이터 출처 · 최종 수집 시각 표기 (plan 모듈 C6, BR-4 법적 고지 정책).
 * `dataFreshness`가 없으면(구조 미로드 상태) 아무것도 렌더링하지 않는다 — 구조 렌더와 독립(E13).
 */
export const DataSourceFooter = () => {
  const { dataFreshness } = useChainViewState();

  if (!dataFreshness) {
    return null;
  }

  return (
    <footer className="mt-4 flex flex-col gap-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
      <p>데이터 출처: {dataFreshness.sources.join(", ")}</p>
      <p className="flex flex-wrap gap-x-3">
        {(Object.keys(FRESHNESS_LABELS) as (keyof typeof FRESHNESS_LABELS)[]).map((key) => (
          <span key={key}>
            {FRESHNESS_LABELS[key]} 최종 수집: {formatCollectedAt(dataFreshness.lastCollectedAt[key])}
          </span>
        ))}
      </p>
    </footer>
  );
};
