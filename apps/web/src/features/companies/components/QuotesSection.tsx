"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { QUOTES_PERIOD_PRESETS, type QuotesPeriodPreset } from "@iib/domain";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { TimeSeriesLineChart } from "@/components/charts/TimeSeriesLineChart";
import {
  QUOTES_MARKET_CAP_MISSING_MESSAGE,
  QUOTES_MULTI_CLASS_PARTIAL_NOTE,
  QUOTES_SECTION_ERROR_MESSAGE,
  QUOTES_SHARES_AS_OF_LABEL_PREFIX,
  SECTION_RETRY_LABEL,
} from "@/features/companies/constants";
import type { QuotesResponse } from "@/features/companies/lib/dto";
import { formatCurrencyAmount } from "@/lib/formatting/number";
import { ApiError } from "@/lib/http/api-client";

type QuotesSectionProps = {
  query: UseQueryResult<QuotesResponse, ApiError>;
  period: QuotesPeriodPreset;
  onPeriodChange: (period: QuotesPeriodPreset) => void;
};

/**
 * S4 일봉 + 시가총액 추이(UC-020 plan 모듈 20) — 로직 없는 Presenter.
 * candles/오류는 이 섹션만 폴백(E8, 정형·재무·공시는 정상 표시 — Container가 섹션 독립을 보장).
 */
export function QuotesSection({ query, period, onPeriodChange }: QuotesSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">주가 · 시가총액</h2>
        <div className="flex gap-1">
          {QUOTES_PERIOD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onPeriodChange(preset)}
              aria-pressed={period === preset}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                period === preset ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {query.isPending && (
        <div data-testid="quotes-loading" className="h-64 animate-pulse rounded-md bg-gray-100" />
      )}

      {query.isError && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-gray-700">{QUOTES_SECTION_ERROR_MESSAGE}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {SECTION_RETRY_LABEL}
          </button>
        </div>
      )}

      {query.isSuccess && (
        <>
          <CandlestickChart
            candles={query.data.candles.map((c) => ({
              time: c.tradeDate,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              isClosingConfirmed: c.isClosingConfirmed,
            }))}
          />

          {query.data.sharesMeta ? (
            <div className="flex flex-col gap-1">
              <TimeSeriesLineChart
                data={query.data.marketCapSeries.map((point) => ({
                  x: point.tradeDate,
                  y: point.marketCap,
                }))}
                yFormatter={(value) => formatCurrencyAmount(value, query.data.currency, "-")}
              />
              <p className="text-xs text-gray-400">
                {QUOTES_SHARES_AS_OF_LABEL_PREFIX}: {query.data.sharesMeta.asOfDate}
                {query.data.sharesMeta.isMultiClassPartial && ` · ${QUOTES_MULTI_CLASS_PARTIAL_NOTE}`}
              </p>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-500">{QUOTES_MARKET_CAP_MISSING_MESSAGE}</p>
          )}
        </>
      )}
    </section>
  );
}
