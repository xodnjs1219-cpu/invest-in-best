import type { Metadata } from "next";
import { StockSearchPage } from "@/features/explore/components/StockSearchPage";

/**
 * 종목 검색 페이지 셸 — Server Component: 클라이언트 경계 배치만.
 * 데이터 페칭·로직 없음(검색은 클라이언트 쿼리 훅이 담당).
 * 밸류체인 탐색(/explore)과 분리된 개별 종목 검색 전용 경로.
 */
export const metadata: Metadata = {
  title: "종목 검색",
  description: "티커·종목명으로 KRX·US 상장기업을 통합 검색하고 시세·재무·소속 밸류체인을 확인하세요.",
  alternates: { canonical: "/stocks" },
};

export default function StocksPage() {
  return <StockSearchPage />;
}
