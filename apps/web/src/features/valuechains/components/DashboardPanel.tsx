"use client";

import { formatKrwCompactOrNull } from "@/lib/formatting/number";
import {
  useChainViewActions,
  useChainViewState,
} from "@/features/valuechains/context/chain-view-context";
import { MetricsRangeSelector } from "@/features/valuechains/components/MetricsRangeSelector";
import { DailyMetricsChart } from "@/features/valuechains/components/DailyMetricsChart";
import { QuarterlyMetricsChart } from "@/features/valuechains/components/QuarterlyMetricsChart";
import { CoverageBadge } from "@/features/valuechains/components/CoverageBadge";
import { MetricsAnnotations } from "@/features/valuechains/components/MetricsAnnotations";

/**
 * 대시보드 패널 컨테이너 (UC-010 plan 모듈 22) — 현재값 카드 + 기간 선택 + 차트 2종 배치.
 * Presenter — `useChainViewState()`/`useChainViewActions()` 두 훅만 소비.
 * 일별·분기 각각 독립 status 분기(한쪽 실패가 다른 쪽을 막지 않음).
 */
export const DashboardPanel = () => {
  const { dailyMetrics, quarterlyMetrics, dashboardRange } = useChainViewState();
  const { changeDashboardRange, retryDailyMetrics, retryQuarterlyMetrics } = useChainViewActions();

  return (
    <section className="mt-8 space-y-6" aria-label="밸류체인 대시보드">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">대시보드</h2>
        <MetricsRangeSelector range={dashboardRange} onChange={changeDashboardRange} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 일별 가치총액 */}
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">가치총액</h3>
            <MetricsAnnotations
              variant="daily"
              annotations={
                dailyMetrics.status === "ready"
                  ? dailyMetrics.annotations
                  : { baseCurrency: "KRW", fxBasis: "daily", sharesAsOfDateMin: null, sharesAsOfDateMax: null, isClosingConfirmed: true }
              }
            />
          </div>

          {dailyMetrics.status === "loading" && (
            <div data-testid="daily-metrics-skeleton" className="h-52 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          )}
          {dailyMetrics.status === "error" && (
            <div className="flex h-52 flex-col items-center justify-center gap-2 text-sm text-gray-500">
              <p>지표를 불러오지 못했습니다.</p>
              <button
                type="button"
                onClick={retryDailyMetrics}
                className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                다시 시도
              </button>
            </div>
          )}
          {dailyMetrics.status === "empty" && (
            <div className="flex h-52 items-center justify-center text-sm text-gray-500">
              집계 준비 중입니다.
            </div>
          )}
          {dailyMetrics.status === "ready" && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {formatKrwCompactOrNull(dailyMetrics.current?.totalMarketCapKrw ?? null, "지표 미산출")}
                </span>
                {dailyMetrics.current?.isCarriedForward && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    이월값
                  </span>
                )}
                {dailyMetrics.annotations.isClosingConfirmed === false && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    종가 미확정
                  </span>
                )}
              </div>
              <CoverageBadge
                covered={dailyMetrics.current?.coveredNodeCount ?? 0}
                total={dailyMetrics.current?.totalNodeCount ?? 0}
              />
              <DailyMetricsChart view={dailyMetrics} />
            </div>
          )}
        </div>

        {/* 분기 매출 합계 */}
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">구성 기업 매출 합계</h3>
            <MetricsAnnotations
              variant="quarterly"
              annotations={
                quarterlyMetrics.status === "ready"
                  ? quarterlyMetrics.annotations
                  : { baseCurrency: "KRW", fxBasis: "quarter_end", revenueOverlapNotice: true }
              }
            />
          </div>

          {quarterlyMetrics.status === "loading" && (
            <div data-testid="quarterly-metrics-skeleton" className="h-52 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          )}
          {quarterlyMetrics.status === "error" && (
            <div className="flex h-52 flex-col items-center justify-center gap-2 text-sm text-gray-500">
              <p>지표를 불러오지 못했습니다.</p>
              <button
                type="button"
                onClick={retryQuarterlyMetrics}
                className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                다시 시도
              </button>
            </div>
          )}
          {quarterlyMetrics.status === "empty" && (
            <div className="flex h-52 items-center justify-center text-sm text-gray-500">
              집계 준비 중입니다.
            </div>
          )}
          {quarterlyMetrics.status === "ready" && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {quarterlyMetrics.current
                    ? formatKrwCompactOrNull(quarterlyMetrics.current.totalRevenueKrw, "지표 미산출")
                    : "미제공"}
                </span>
              </div>
              <CoverageBadge
                covered={quarterlyMetrics.current?.coveredNodeCount ?? 0}
                total={quarterlyMetrics.current?.totalNodeCount ?? 0}
                excludedUnmappedCount={quarterlyMetrics.current?.excludedUnmappedCount}
              />
              <QuarterlyMetricsChart view={quarterlyMetrics} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
