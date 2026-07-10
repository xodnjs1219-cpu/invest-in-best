"use client";

import { formatInTimeZone } from "date-fns-tz";
import type { UseQueryResult } from "@tanstack/react-query";
import { TIMELINE_TIMEZONE } from "@iib/domain";
import { ErrorState, Heading, NumericText, Skeleton } from "@/components/ui";
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
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
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
      <ErrorState
        message={
          error instanceof ApiError
            ? error.message
            : "기업 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        }
        onRetry={() => query.refetch()}
        retryLabel={SECTION_RETRY_LABEL}
      />
    );
  }

  const { security, profile, dataSources } = query.data;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level={1}>{security.name}</Heading>
        {security.englishName && <span className="text-sm text-fg-muted">{security.englishName}</span>}
        <MarketBadge market={security.market} />
        <ListingStatusBadge status={security.listingStatus} />
      </div>
      <p className="font-mono tabular text-sm text-fg-muted">{security.ticker}</p>

      {profile ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {profile.sector && (
            <div>
              <dt className="text-fg-muted">업종</dt>
              <dd className="text-fg">{profile.sector}</dd>
            </div>
          )}
          {profile.representativeName && (
            <div>
              <dt className="text-fg-muted">대표자</dt>
              <dd className="text-fg">{profile.representativeName}</dd>
            </div>
          )}
          {profile.establishedDate && (
            <div>
              <dt className="text-fg-muted">설립일</dt>
              <NumericText as="dd" className="text-fg">{profile.establishedDate}</NumericText>
            </div>
          )}
          {profile.homepageUrl && (
            <div>
              <dt className="text-fg-muted">홈페이지</dt>
              <dd>
                <a
                  href={profile.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-hover hover:underline"
                >
                  {HOMEPAGE_LINK_LABEL}
                </a>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-fg-muted">{PROFILE_NOT_COLLECTED_MESSAGE}</p>
      )}

      <footer className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-xs text-fg-muted">
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
