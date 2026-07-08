"use client";

import Link from "next/link";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  CHAINS_EMPTY_MESSAGE,
  CHAINS_FOCUS_TYPE_LABEL,
  CHAINS_OFFICIAL_BADGE_LABEL,
  CHAINS_SECTION_ERROR_MESSAGE,
  CHAINS_SUMMARY_PENDING_LABEL,
  CHAINS_USER_BADGE_LABEL,
  SECTION_RETRY_LABEL,
} from "@/features/companies/constants";
import type { CompanyValuechainsResponse } from "@/features/companies/lib/dto";
import { formatKrwCompactOrNull } from "@/lib/formatting/number";
import { ApiError } from "@/lib/http/api-client";

type BelongingChainsSectionProps = {
  query: UseQueryResult<CompanyValuechainsResponse, ApiError>;
};

/**
 * S5 소속 밸류체인 목록(UC-020 plan 모듈 21) — 로직 없는 Presenter. 노출 범위 분기 없음(서버 필터, E12).
 * 체인 행 클릭은 밸류체인 뷰(UC-009)로의 Link 이동뿐(라우팅 — Action 아님).
 */
export function BelongingChainsSection({ query }: BelongingChainsSectionProps) {
  if (query.isPending) {
    return <div data-testid="chains-loading" className="h-24 animate-pulse rounded-md bg-gray-100" />;
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-gray-700">{CHAINS_SECTION_ERROR_MESSAGE}</p>
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

  const { items } = query.data;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-gray-900">소속 밸류체인</h2>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{CHAINS_EMPTY_MESSAGE}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.chainId}>
              <Link
                href={`/valuechains/${item.chainId}`}
                className="flex flex-col gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {item.chainType === "official" ? CHAINS_OFFICIAL_BADGE_LABEL : CHAINS_USER_BADGE_LABEL}
                  </span>
                  <span className="text-xs text-gray-500">{CHAINS_FOCUS_TYPE_LABEL[item.focusType]}</span>
                  <span className="text-xs text-gray-500">노드 {item.nodeCount}개</span>
                </div>
                <div className="text-xs text-gray-500">
                  {item.summary ? (
                    <span>
                      {formatKrwCompactOrNull(item.summary.totalMarketCapKrw, "-")} · 반영{" "}
                      {item.summary.coveredNodeCount}/{item.summary.totalNodeCount}
                    </span>
                  ) : (
                    <span>{CHAINS_SUMMARY_PENDING_LABEL}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
