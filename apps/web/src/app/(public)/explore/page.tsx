import type { Metadata } from "next";
import { MainExplorePage } from "@/features/explore/components/MainExplorePage";

/**
 * 탐색 페이지 셸 (UC-007 plan 모듈 E-1) — Server Component: 클라이언트 경계 배치만.
 * 데이터 페칭·로직 없음(목록은 클라이언트 쿼리 훅이 담당 — 영역별 독립 로딩/오류 처리를 위해
 * SSR 프리페치는 하지 않는 최소 구성).
 *
 * 루트(`/`)는 히어로 중심 랜딩페이지, 종목 검색은 `/stocks`로 분리 — 본 경로는 밸류체인 탐색 전용.
 */
export const metadata: Metadata = {
  title: "밸류체인 탐색",
  description: "공식 밸류체인과 내 밸류체인을 한눈에 훑고, 관심 산업의 구조로 진입하세요.",
  alternates: { canonical: "/explore" },
};

export default function ExplorePage() {
  return <MainExplorePage />;
}
