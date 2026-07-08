"use client";

import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
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
    return <div data-testid="disclosures-loading" className="h-32 animate-pulse rounded-md bg-gray-100" />;
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-gray-700">{DISCLOSURES_SECTION_ERROR_MESSAGE}</p>
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

  const items = query.data.pages.flatMap((page) => page.items);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-gray-900">주요 공시</h2>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{DISCLOSURES_EMPTY_MESSAGE}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-gray-50"
              >
                <span className="text-gray-900">{item.title}</span>
                <span className="shrink-0 text-xs text-gray-500">{item.disclosureDate}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {query.isFetchingNextPage ? DISCLOSURES_LOADING_MORE_LABEL : DISCLOSURES_LOAD_MORE_LABEL}
          </button>
        </div>
      )}
    </section>
  );
}
