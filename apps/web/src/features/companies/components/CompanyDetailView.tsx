"use client";

import { useCallback, useMemo, useReducer } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTimelineToday, type FinancialsPeriodPreset, type QuotesPeriodPreset } from "@iib/domain";
import { useBelongingChains } from "@/features/companies/hooks/useBelongingChains";
import { useCompanySummary } from "@/features/companies/hooks/useCompanySummary";
import { useDisclosures } from "@/features/companies/hooks/useDisclosures";
import { useFinancials } from "@/features/companies/hooks/useFinancials";
import { useQuotes } from "@/features/companies/hooks/useQuotes";
import {
  companyDetailReducer,
  createInitialCompanyDetailState,
} from "@/features/companies/state/company-detail.reducer";
import {
  selectFinancialsYearRange,
  selectQuotesDateRange,
} from "@/features/companies/state/company-detail.selectors";
import { BelongingChainsSection } from "@/features/companies/components/BelongingChainsSection";
import { CompanySummarySection } from "@/features/companies/components/CompanySummarySection";
import { DisclosuresSection } from "@/features/companies/components/DisclosuresSection";
import { FinancialsSection } from "@/features/companies/components/FinancialsSection";
import { QuotesSection } from "@/features/companies/components/QuotesSection";
import { TimelineContextNotice } from "@/features/companies/components/TimelineContextNotice";

export type CompanyDetailViewProps = {
  ticker: string;
  market: "KRX" | "US" | null;
  asOf: string | null;
};

/**
 * 기업 상세(UC-020) Container(state_management.md §6.1) — useReducer + 쿼리 훅 조립.
 * Context 미사용(Level 2) — 하위 Presenter에는 props로만 전달한다.
 */
export function CompanyDetailView({ ticker, market, asOf }: CompanyDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [state, dispatch] = useReducer(companyDetailReducer, undefined, createInitialCompanyDetailState);

  const today = useMemo(() => getTimelineToday(), []);
  const currentYear = Number(today.slice(0, 4));

  const summaryQuery = useCompanySummary(ticker, market ?? undefined);
  const securityId = summaryQuery.data?.security.id;

  const quotesRange = useMemo(
    () => selectQuotesDateRange(state.quotesPeriod, today),
    [state.quotesPeriod, today],
  );
  const financialsRange = useMemo(
    () => selectFinancialsYearRange(state.financialsPeriod, currentYear),
    [state.financialsPeriod, currentYear],
  );

  const financialsQuery = useFinancials(securityId, financialsRange);
  const disclosuresQuery = useDisclosures(securityId);
  const quotesQuery = useQuotes(securityId, quotesRange);
  const belongingChainsQuery = useBelongingChains(securityId);

  const onQuotesPeriodChange = useCallback((period: QuotesPeriodPreset) => {
    dispatch({ type: "QUOTES_PERIOD_CHANGED", payload: { period } });
  }, []);

  const onFinancialsPeriodChange = useCallback((period: FinancialsPeriodPreset) => {
    dispatch({ type: "FINANCIALS_PERIOD_CHANGED", payload: { period } });
  }, []);

  const onDismissNotice = useCallback(() => {
    dispatch({ type: "TIMELINE_NOTICE_DISMISSED" });
  }, []);

  const onMarketSelect = useCallback(
    (nextMarket: "KRX" | "US") => {
      const params = new URLSearchParams();
      params.set("market", nextMarket);
      if (asOf) {
        params.set("asOf", asOf);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, asOf],
  );

  const isSummaryReady = summaryQuery.isSuccess;

  return (
    <div className="flex flex-col gap-6">
      <TimelineContextNotice
        asOfDate={asOf}
        isDismissed={state.isTimelineNoticeDismissed}
        onDismiss={onDismissNotice}
      />

      <CompanySummarySection query={summaryQuery} onMarketSelect={onMarketSelect} />

      {isSummaryReady && (
        <>
          <FinancialsSection
            query={financialsQuery}
            period={state.financialsPeriod}
            onPeriodChange={onFinancialsPeriodChange}
          />
          <QuotesSection
            query={quotesQuery}
            period={state.quotesPeriod}
            onPeriodChange={onQuotesPeriodChange}
          />
          <DisclosuresSection query={disclosuresQuery} />
          <BelongingChainsSection query={belongingChainsQuery} />
        </>
      )}
    </div>
  );
}
