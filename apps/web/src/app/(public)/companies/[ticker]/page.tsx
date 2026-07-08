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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params;
  return { title: `${ticker} — 기업 상세` };
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
