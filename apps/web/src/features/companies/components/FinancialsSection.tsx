"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { FINANCIALS_PERIOD_PRESETS, type FinancialsPeriodPreset } from "@iib/domain";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { EmptyState, ErrorState, Heading, NumericText, Skeleton } from "@/components/ui";
import {
  FINANCIALS_ANNUAL_ONLY_NOTE,
  FINANCIALS_DERIVED_FROM_CUMULATIVE_NOTE,
  FINANCIALS_EMPTY_MESSAGE,
  FINANCIALS_REVENUE_UNMAPPED_NOTE,
  FINANCIALS_RETRY_LABEL,
  FINANCIALS_SECTION_ERROR_MESSAGE,
} from "@/features/companies/constants";
import type { FinancialsResponse } from "@/features/companies/lib/dto";
import { formatCurrencyAmount } from "@/lib/formatting/number";
import { ApiError } from "@/lib/http/api-client";

type FinancialsSectionProps = {
  query: UseQueryResult<FinancialsResponse, ApiError>;
  period: FinancialsPeriodPreset;
  onPeriodChange: (period: FinancialsPeriodPreset) => void;
};

const periodLabel = (period: FinancialsPeriodPreset) => period;

const buildAxisLabel = (item: FinancialsResponse["items"][number]): string =>
  item.periodType === "annual" || item.fiscalQuarter === null
    ? `${item.fiscalYear}`
    : `${item.fiscalYear}Q${item.fiscalQuarter}`;

const FINANCIALS_SERIES = [
  { key: "revenue", label: "매출" },
  { key: "operatingIncome", label: "영업이익" },
  { key: "netIncome", label: "순이익" },
] as const;

/**
 * S2 분기 재무 표 + 그래프(UC-020 plan 모듈 18) — 로직 없는 Presenter.
 * 분기: 로딩 / 오류(폴백+재시도) / items:[] → 결측 안내 / 성공 → 표+그래프.
 */
export function FinancialsSection({ query, period, onPeriodChange }: FinancialsSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Heading level={2}>분기 재무</Heading>
        <div className="flex gap-1">
          {FINANCIALS_PERIOD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onPeriodChange(preset)}
              aria-pressed={period === preset}
              className={`min-h-9 rounded-sm px-3 text-xs ${
                period === preset
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-sunken text-fg-muted hover:bg-surface-hover"
              }`}
            >
              {periodLabel(preset)}
            </button>
          ))}
        </div>
      </div>

      {query.isPending && (
        <Skeleton data-testid="financials-loading" className="h-80" />
      )}

      {query.isError && (
        <ErrorState
          message={FINANCIALS_SECTION_ERROR_MESSAGE}
          onRetry={() => query.refetch()}
          retryLabel={FINANCIALS_RETRY_LABEL}
        />
      )}

      {query.isSuccess && query.data.items.length === 0 && (
        <EmptyState message={FINANCIALS_EMPTY_MESSAGE} />
      )}

      {query.isSuccess && query.data.items.length > 0 && (
        <>
          {query.data.annotations.isAnnualOnly && (
            <p className="text-xs text-warning">{FINANCIALS_ANNUAL_ONLY_NOTE}</p>
          )}

          <CategoryBarChart
            series={FINANCIALS_SERIES as unknown as { key: string; label: string }[]}
            data={query.data.items.map((item) => ({
              x: buildAxisLabel(item),
              values: {
                revenue: item.revenue,
                operatingIncome: item.operatingIncome,
                netIncome: item.netIncome,
              },
            }))}
            yFormatter={(value) => formatCurrencyAmount(value, query.data.currency, "-")}
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-fg-muted">
                  <th className="py-2 pr-4">기간</th>
                  <th className="py-2 pr-4 text-right">매출</th>
                  <th className="py-2 pr-4 text-right">영업이익</th>
                  <th className="py-2 pr-4 text-right">순이익</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={`${item.fiscalYear}-${item.fiscalQuarter ?? "annual"}`} className="border-b border-border">
                    <NumericText as="td" className="py-2 pr-4">{buildAxisLabel(item)}</NumericText>
                    <NumericText as="td" align="right" className="py-2 pr-4">
                      {item.revenue === null && item.isRevenueTagUnmapped
                        ? FINANCIALS_REVENUE_UNMAPPED_NOTE
                        : formatCurrencyAmount(item.revenue, query.data.currency, "-")}
                    </NumericText>
                    <NumericText as="td" align="right" className="py-2 pr-4">
                      {formatCurrencyAmount(item.operatingIncome, query.data.currency, "-")}
                    </NumericText>
                    <NumericText as="td" align="right" className="py-2 pr-4">
                      {formatCurrencyAmount(item.netIncome, query.data.currency, "-")}
                      {item.amountBasis === "derived_from_cumulative" && (
                        <span
                          title={FINANCIALS_DERIVED_FROM_CUMULATIVE_NOTE}
                          className="ml-1 cursor-help text-xs text-fg-subtle"
                        >
                          *
                        </span>
                      )}
                    </NumericText>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-fg-subtle">보고 통화: {query.data.currency}</p>
        </>
      )}
    </section>
  );
}
