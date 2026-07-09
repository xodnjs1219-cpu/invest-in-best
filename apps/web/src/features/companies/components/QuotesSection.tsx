"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { QUOTES_PERIOD_PRESETS, type QuotesPeriodPreset } from "@iib/domain";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { TimeSeriesLineChart } from "@/components/charts/TimeSeriesLineChart";
import { ErrorState, Heading, Skeleton } from "@/components/ui";
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
        <Heading level={2}>주가 · 시가총액</Heading>
        <div className="flex gap-1">
          {QUOTES_PERIOD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onPeriodChange(preset)}
              aria-pressed={period === preset}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                period === preset
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-sunken text-fg-muted hover:bg-surface-hover"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {query.isPending && (
        <Skeleton data-testid="quotes-loading" className="h-64" />
      )}

      {query.isError && (
        <ErrorState
          message={QUOTES_SECTION_ERROR_MESSAGE}
          onRetry={() => query.refetch()}
          retryLabel={SECTION_RETRY_LABEL}
        />
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
              <p className="text-xs text-fg-subtle">
                {QUOTES_SHARES_AS_OF_LABEL_PREFIX}: {query.data.sharesMeta.asOfDate}
                {query.data.sharesMeta.isMultiClassPartial && ` · ${QUOTES_MULTI_CLASS_PARTIAL_NOTE}`}
              </p>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-fg-muted">{QUOTES_MARKET_CAP_MISSING_MESSAGE}</p>
          )}
        </>
      )}
    </section>
  );
}
