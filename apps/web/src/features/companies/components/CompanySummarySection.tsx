"use client";

import { formatInTimeZone } from "date-fns-tz";
import type { UseQueryResult } from "@tanstack/react-query";
import { TIMELINE_TIMEZONE } from "@iib/domain";
import { ListingStatusBadge, MarketBadge } from "@/features/securities/components/SecurityBadges";
import { CompanyNotFoundFallback } from "@/features/companies/components/CompanyNotFoundFallback";
import { MarketSelectPrompt } from "@/features/companies/components/MarketSelectPrompt";
import {
  DATA_SOURCE_LABEL_BY_MARKET,
  HOMEPAGE_LINK_LABEL,
  LAST_COLLECTED_NOT_YET_LABEL,
  PROFILE_NOT_COLLECTED_MESSAGE,
  SECTION_RETRY_LABEL,
} from "@/features/companies/constants";
import type { CompanySummaryResponse } from "@/features/companies/lib/dto";
import { ApiError } from "@/lib/http/api-client";

type CompanySummarySectionProps = {
  query: UseQueryResult<CompanySummaryResponse, ApiError>;
  onMarketSelect: (market: "KRX" | "US") => void;
};

const formatCollected = (iso: string | null): string => {
  if (!iso) {
    return LAST_COLLECTED_NOT_YET_LABEL;
  }
  return formatInTimeZone(new Date(iso), TIMELINE_TIMEZONE, "yyyy-MM-dd HH:mm");
};

/**
 * S1 정형 정보 + S6 출처·수집 시각(UC-020 plan 모듈 17) — 로직 없는 Presenter.
 * 분기: 로딩 스켈레톤 / 404 → NotFound / 409 → MarketSelectPrompt / 그 외 오류 → 섹션 폴백 / 성공 → 렌더.
 */
export function CompanySummarySection({ query, onMarketSelect }: CompanySummarySectionProps) {
  if (query.isPending) {
    return (
      <div data-testid="company-summary-loading" className="flex flex-col gap-2">
        <div className="h-8 w-1/2 animate-pulse rounded-md bg-gray-100" />
        <div className="h-4 w-1/3 animate-pulse rounded-md bg-gray-100" />
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.status === 404) {
      return <CompanyNotFoundFallback />;
    }
    if (error instanceof ApiError && error.status === 409) {
      return <MarketSelectPrompt onMarketSelect={onMarketSelect} />;
    }
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-gray-700">{error instanceof ApiError ? error.message : "오류가 발생했습니다."}</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {SECTION_RETRY_LABEL}
        </button>
      </div>
    );
  }

  const { security, profile, dataSources } = query.data;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900">{security.name}</h1>
        {security.englishName && <span className="text-sm text-gray-500">{security.englishName}</span>}
        <MarketBadge market={security.market} />
        <ListingStatusBadge status={security.listingStatus} />
      </div>
      <p className="text-sm text-gray-500">{security.ticker}</p>

      {profile ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {profile.sector && (
            <div>
              <dt className="text-gray-500">업종</dt>
              <dd className="text-gray-900">{profile.sector}</dd>
            </div>
          )}
          {profile.representativeName && (
            <div>
              <dt className="text-gray-500">대표자</dt>
              <dd className="text-gray-900">{profile.representativeName}</dd>
            </div>
          )}
          {profile.establishedDate && (
            <div>
              <dt className="text-gray-500">설립일</dt>
              <dd className="text-gray-900">{profile.establishedDate}</dd>
            </div>
          )}
          {profile.homepageUrl && (
            <div>
              <dt className="text-gray-500">홈페이지</dt>
              <dd>
                <a
                  href={profile.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {HOMEPAGE_LINK_LABEL}
                </a>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-gray-500">{PROFILE_NOT_COLLECTED_MESSAGE}</p>
      )}

      <footer className="mt-2 flex flex-col gap-1 border-t border-gray-100 pt-2 text-xs text-gray-500">
        <p>데이터 출처: {DATA_SOURCE_LABEL_BY_MARKET[security.market]}</p>
        <p className="flex flex-wrap gap-x-3">
          <span>정형 정보 수집: {formatCollected(profile?.lastCollectedAt ?? null)}</span>
          <span>시세 최신: {dataSources.lastQuoteDate ?? LAST_COLLECTED_NOT_YET_LABEL}</span>
          <span>공시 최신: {dataSources.lastDisclosureDate ?? LAST_COLLECTED_NOT_YET_LABEL}</span>
        </p>
      </footer>
    </section>
  );
}
