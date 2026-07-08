"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { FINANCIALS_PERIOD_PRESETS, type FinancialsPeriodPreset } from "@iib/domain";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
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
        <h2 className="text-lg font-semibold text-gray-900">분기 재무</h2>
        <div className="flex gap-1">
          {FINANCIALS_PERIOD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onPeriodChange(preset)}
              aria-pressed={period === preset}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                period === preset ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700"
              }`}
            >
              {periodLabel(preset)}
            </button>
          ))}
        </div>
      </div>

      {query.isPending && (
        <div data-testid="financials-loading" className="h-48 animate-pulse rounded-md bg-gray-100" />
      )}

      {query.isError && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-gray-700">{FINANCIALS_SECTION_ERROR_MESSAGE}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {FINANCIALS_RETRY_LABEL}
          </button>
        </div>
      )}

      {query.isSuccess && query.data.items.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">{FINANCIALS_EMPTY_MESSAGE}</p>
      )}

      {query.isSuccess && query.data.items.length > 0 && (
        <>
          {query.data.annotations.isAnnualOnly && (
            <p className="text-xs text-amber-700">{FINANCIALS_ANNUAL_ONLY_NOTE}</p>
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
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 pr-4">기간</th>
                  <th className="py-2 pr-4">매출</th>
                  <th className="py-2 pr-4">영업이익</th>
                  <th className="py-2 pr-4">순이익</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={`${item.fiscalYear}-${item.fiscalQuarter ?? "annual"}`} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{buildAxisLabel(item)}</td>
                    <td className="py-2 pr-4">
                      {item.revenue === null && item.isRevenueTagUnmapped
                        ? FINANCIALS_REVENUE_UNMAPPED_NOTE
                        : formatCurrencyAmount(item.revenue, query.data.currency, "-")}
                    </td>
                    <td className="py-2 pr-4">
                      {formatCurrencyAmount(item.operatingIncome, query.data.currency, "-")}
                    </td>
                    <td className="py-2 pr-4">
                      {formatCurrencyAmount(item.netIncome, query.data.currency, "-")}
                      {item.amountBasis === "derived_from_cumulative" && (
                        <span
                          title={FINANCIALS_DERIVED_FROM_CUMULATIVE_NOTE}
                          className="ml-1 cursor-help text-xs text-gray-400"
                        >
                          *
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">보고 통화: {query.data.currency}</p>
        </>
      )}
    </section>
  );
}
