import type { Metadata } from "next";
import { CompanyDetailView } from "@/features/companies/components/CompanyDetailView";

type PageProps = {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ market?: string; asOf?: string }>;
};

const VALID_MARKETS = new Set(["KRX", "US"]);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseMarket = (raw: string | undefined): "KRX" | "US" | null =>
  raw && VALID_MARKETS.has(raw) ? (raw as "KRX" | "US") : null;

const parseAsOf = (raw: string | undefined): string | null =>
  raw && ISO_DATE_PATTERN.test(raw) ? raw : null;

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { ticker } = await params;
  const { market: marketRaw } = await searchParams;
  const market = parseMarket(marketRaw);

  const title = `${ticker} — 기업 상세`;
  const description = `${ticker}${market ? ` (${market})` : ""} 기업의 밸류체인 소속·핵심 지표·현황을 invest-in-best에서 확인하세요.`;
  // 시장이 명시된 표준 형태를 canonical로 지정(같은 티커의 파라미터 변형 중복 방지).
  const canonical = `/companies/${encodeURIComponent(ticker)}${market ? `?market=${market}` : ""}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
    },
    twitter: {
      title,
      description,
    },
  };
}

/**
 * 기업 상세(UC-020) 페이지 셸 — Server Component: params/searchParams(Promise) 해석 후
 * Container(`CompanyDetailView`)에 위임한다(state_management.md §6). 비로그인 접근 허용((public) 그룹).
 */
export default async function CompanyDetailPage({ params, searchParams }: PageProps) {
  const { ticker } = await params;
  const { market: marketRaw, asOf: asOfRaw } = await searchParams;

  const market = parseMarket(marketRaw);
  const asOf = parseAsOf(asOfRaw);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <CompanyDetailView ticker={ticker} market={market} asOf={asOf} />
    </div>
  );
}
