"use client";

import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { Button, EmptyState, ErrorState, Heading, NumericText, Skeleton } from "@/components/ui";
import {
  DISCLOSURES_EMPTY_MESSAGE,
  DISCLOSURES_LOADING_MORE_LABEL,
  DISCLOSURES_LOAD_MORE_LABEL,
  DISCLOSURES_SECTION_ERROR_MESSAGE,
  SECTION_RETRY_LABEL,
} from "@/features/companies/constants";
import type { DisclosuresResponse } from "@/features/companies/lib/dto";
import { ApiError } from "@/lib/http/api-client";

type DisclosuresSectionProps = {
  query: UseInfiniteQueryResult<InfiniteData<DisclosuresResponse>, ApiError>;
};

/**
 * S3 주요 공시 목록(UC-020 plan 모듈 19) — 로직 없는 Presenter. 더보기=`fetchNextPage()`(reducer 미관여).
 * 원문 링크는 외부 새 창(서버 프록시 없음, spec §6.5).
 */
export function DisclosuresSection({ query }: DisclosuresSectionProps) {
  if (query.isPending) {
    return <Skeleton data-testid="disclosures-loading" className="h-32" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message={DISCLOSURES_SECTION_ERROR_MESSAGE}
        onRetry={() => query.refetch()}
        retryLabel={SECTION_RETRY_LABEL}
      />
    );
  }

  const items = query.data.pages.flatMap((page) => page.items);

  return (
    <section className="flex flex-col gap-2">
      <Heading level={2}>주요 공시</Heading>

      {items.length === 0 ? (
        <EmptyState message={DISCLOSURES_EMPTY_MESSAGE} />
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-[var(--radius)] px-2 py-2 text-sm hover:bg-surface-hover"
              >
                <span className="text-fg">{item.title}</span>
                <NumericText className="shrink-0 text-xs text-fg-muted">{item.disclosureDate}</NumericText>
              </a>
            </li>
          ))}
        </ul>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center pt-1">
          <Button
            variant="secondary"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? DISCLOSURES_LOADING_MORE_LABEL : DISCLOSURES_LOAD_MORE_LABEL}
          </Button>
        </div>
      )}
    </section>
  );
}
