"use client";

import { Badge, Card, EmptyState, ErrorState, Heading, Skeleton } from "@/components/ui";
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
    <section className="space-y-6" aria-label="밸류체인 대시보드">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={2}>대시보드</Heading>
        <MetricsRangeSelector range={dashboardRange} onChange={changeDashboardRange} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 일별 가치총액 */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <Heading level={3}>가치총액</Heading>
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
            <Skeleton data-testid="daily-metrics-skeleton" className="h-52" />
          )}
          {dailyMetrics.status === "error" && (
            <ErrorState
              message="지표를 불러오지 못했습니다."
              onRetry={retryDailyMetrics}
              className="h-52 justify-center"
            />
          )}
          {dailyMetrics.status === "empty" && (
            <EmptyState message="집계 준비 중입니다." className="h-52 justify-center" />
          )}
          {dailyMetrics.status === "ready" && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-fg">
                  {formatKrwCompactOrNull(dailyMetrics.current?.totalMarketCapKrw ?? null, "지표 미산출")}
                </span>
                {dailyMetrics.current?.isCarriedForward && <Badge tone="warning">이월값</Badge>}
                {dailyMetrics.annotations.isClosingConfirmed === false && (
                  <Badge tone="warning">종가 미확정</Badge>
                )}
              </div>
              <CoverageBadge
                covered={dailyMetrics.current?.coveredNodeCount ?? 0}
                total={dailyMetrics.current?.totalNodeCount ?? 0}
              />
              <DailyMetricsChart view={dailyMetrics} />
            </div>
          )}
        </Card>

        {/* 분기 매출 합계 */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <Heading level={3}>구성 기업 매출 합계</Heading>
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
            <Skeleton data-testid="quarterly-metrics-skeleton" className="h-52" />
          )}
          {quarterlyMetrics.status === "error" && (
            <ErrorState
              message="지표를 불러오지 못했습니다."
              onRetry={retryQuarterlyMetrics}
              className="h-52 justify-center"
            />
          )}
          {quarterlyMetrics.status === "empty" && (
            <EmptyState message="집계 준비 중입니다." className="h-52 justify-center" />
          )}
          {quarterlyMetrics.status === "ready" && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-fg">
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
        </Card>
      </div>
    </section>
  );
};
