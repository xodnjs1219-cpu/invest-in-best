"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui";
import { formatKrwCompactOrNull } from "@/lib/formatting/number";
import { useChainViewState } from "@/features/valuechains/context/chain-view-context";

/**
 * 밸류체인 요약 스트립 (뷰어 리뉴얼) — 마인드맵 위에 핵심 지표를 stat 카드로 먼저 노출한다
 * ("요약 먼저" 정보 설계). 대시보드와 동일한 context 상태를 읽으므로 추가 페칭이 없다.
 * 각 지표는 독립 status를 가지며 로딩/미산출을 개별 처리한다.
 */

function StatCard({
  eyebrow,
  value,
  meta,
  loading,
  accent,
}: {
  eyebrow: string;
  value: ReactNode;
  meta?: ReactNode;
  loading?: boolean;
  accent?: "value" | "data";
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-border bg-surface-raised p-4 shadow-ambient">
      <span className="text-[11px] uppercase tracking-wide text-fg-subtle">
        {eyebrow}
      </span>
      {loading ? (
        <Skeleton className="h-7 w-28" />
      ) : (
        <span
          className={`font-mono tabular text-2xl ${accent === "data" ? "text-data" : "text-fg"}`}
        >
          {value}
        </span>
      )}
      {meta && <span className="text-xs text-fg-muted">{meta}</span>}
    </div>
  );
}

export const ChainSummaryStrip = () => {
  const { dailyMetrics, quarterlyMetrics } = useChainViewState();

  const dailyReady = dailyMetrics.status === "ready";
  const quarterlyReady = quarterlyMetrics.status === "ready";

  const coverage = dailyReady
    ? `반영 ${dailyMetrics.current?.coveredNodeCount ?? 0}/${dailyMetrics.current?.totalNodeCount ?? 0} 노드`
    : null;

  return (
    <section aria-label="밸류체인 핵심 지표" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        eyebrow="가치총액"
        loading={dailyMetrics.status === "loading"}
        value={
          dailyReady
            ? formatKrwCompactOrNull(dailyMetrics.current?.totalMarketCapKrw ?? null, "미산출")
            : "—"
        }
        accent="value"
      />
      <StatCard
        eyebrow="구성 기업 매출 합계"
        loading={quarterlyMetrics.status === "loading"}
        value={
          quarterlyReady
            ? formatKrwCompactOrNull(quarterlyMetrics.current?.totalRevenueKrw ?? null, "미산출")
            : "—"
        }
      />
      <StatCard
        eyebrow="지표 커버리지"
        loading={dailyMetrics.status === "loading"}
        value={dailyReady ? `${dailyMetrics.current?.coveredNodeCount ?? 0}` : "—"}
        meta={coverage ?? "집계 준비 중"}
        accent="data"
      />
    </section>
  );
};
